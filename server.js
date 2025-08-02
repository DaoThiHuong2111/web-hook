require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST_PORT = process.env.HOST_PORT || 3000;
const CONTAINER_PORT = process.env.CONTAINER_PORT || 3000;

// Middleware để parse JSON
app.use(express.json());

// GitHub webhook secret (nên đặt trong environment variable)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';

// Docker Hub credentials
const DOCKER_USERNAME = process.env.DOCKER_USERNAME;
const DOCKER_PASSWORD = process.env.DOCKER_PASSWORD;
const DOCKER_REPO = process.env.DOCKER_REPO || 'your-repo/nextjs-app';

// Project directory - nơi chứa Next.js project
const PROJECT_DIR = process.env.PROJECT_DIR || '/var/www/nextjs-project';
const REPO_URL = process.env.REPO_URL;

// Hàm verify GitHub webhook signature
function verifyGitHubSignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Hàm execute command với Promise
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

// Route chính cho GitHub webhook
app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature
    if (!verifyGitHubSignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    console.log(`Received GitHub event: ${event}`);

    // Chỉ xử lý create events (khi tạo tag)
    if (event !== 'create') {
      console.log('Not a create event, ignoring...');
      return res.status(200).json({ message: 'Event ignored' });
    }

    const { ref, ref_type, repository } = req.body;
    
    // Kiểm tra xem có phải là tag không
    if (ref_type !== 'tag') {
      console.log('Not a tag creation, ignoring...');
      return res.status(200).json({ message: 'Not a tag, ignored' });
    }

    console.log(`Tag created: ${ref}`);
    
    // Đảm bảo project directory tồn tại
    const isReady = await ensureProjectDirectory();
    if (!isReady) {
      return res.status(500).json({ error: 'Failed to prepare project directory' });
    }
    
    // Kiểm tra xem tag có được tạo từ staging branch không
    const tagInfo = await getTagBranch(ref);
    
    if (!tagInfo.isFromStaging) {
      console.log(`Tag ${ref} is not from staging branch, ignoring...`);
      return res.status(200).json({ message: 'Tag not from staging branch, ignored' });
    }

    console.log(`Tag ${ref} is from staging branch, starting CI process...`);
    
    // Bắt đầu quá trình CI
    await runCIProcess(ref);
    
    res.status(200).json({ message: 'CI process started successfully' });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Hàm kiểm tra và chuẩn bị project directory
async function ensureProjectDirectory() {
  try {
    if (!fs.existsSync(PROJECT_DIR)) {
      console.log(`Project directory không tồn tại, tạo thư mục: ${PROJECT_DIR}`);
      await executeCommand(`mkdir -p ${PROJECT_DIR}`);
      
      // Clone repository lần đầu
      console.log('Cloning repository lần đầu...');
      await executeCommand(`git clone ${REPO_URL} ${PROJECT_DIR}`);
    }
    return true;
  } catch (error) {
    console.error('Error ensuring project directory:', error);
    return false;
  }
}

// Hàm kiểm tra tag có từ staging branch không
async function getTagBranch(tagName) {
  try {
    // Chuyển vào thư mục project
    const originalDir = process.cwd();
    process.chdir(PROJECT_DIR);
    
    // Update repository
    console.log('Fetching latest changes...');
    await executeCommand('git fetch --all --tags');
    
    // Kiểm tra branch chứa tag
    const result = await executeCommand(`git branch -r --contains ${tagName}`);
    const branches = result.split('\n').map(branch => branch.trim().replace('origin/', ''));
    
    // Kiểm tra xem có staging branch không
    const isFromStaging = branches.some(branch => branch.includes('staging'));
    
    // Trở về thư mục gốc
    process.chdir(originalDir);
    
    return { isFromStaging, branches };
    
  } catch (error) {
    console.error('Error checking tag branch:', error);
    return { isFromStaging: false, branches: [] };
  }
}

// Hàm chạy quá trình CI
async function runCIProcess(tagName) {
  try {
    const originalDir = process.cwd();
    
    console.log('Starting CI process...');
    
    // 1. Chuyển vào thư mục project
    console.log('Switching to project directory...');
    process.chdir(PROJECT_DIR);
    
    // 2. Pull latest changes và checkout to tag
    console.log('Pulling latest changes...');
    await executeCommand('git fetch --all --tags');
    await executeCommand('git reset --hard HEAD');
    
    console.log(`Checking out to tag ${tagName}...`);
    await executeCommand(`git checkout ${tagName}`);
    
    // 3. Build Docker image sử dụng Dockerfile có sẵn
    console.log('Building Docker image...');
    const imageName = `${DOCKER_REPO}:${tagName}`;
    await executeCommand(`docker build -t ${imageName} .`);
    
    // 4. Login to Docker Hub
    console.log('Logging in to Docker Hub...');
    await executeCommand(`echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin`);
    
    // 5. Push image to Docker Hub
    console.log('Pushing image to Docker Hub...');
    await executeCommand(`docker push ${imageName}`);
    
    // 6. Run the container
    console.log('Running the container...');
    const containerName = `nextjs-app-${tagName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    // Stop existing container if exists
    try {
      await executeCommand(`docker stop ${containerName}`);
      await executeCommand(`docker rm ${containerName}`);
    } catch (error) {
      // Container might not exist, ignore error
      console.log('No existing container to stop');
    }
    
    // Run new container with configurable ports
    await executeCommand(
      `docker run -d --name ${containerName} -p ${HOST_PORT}:${CONTAINER_PORT} -e PORT=${CONTAINER_PORT} ${imageName}`
    );
    
    console.log('CI process completed successfully!');
    
    // Trở về thư mục gốc
    process.chdir(originalDir);
    
  } catch (error) {
    console.error('CI process failed:', error);
    // Trở về thư mục gốc nếu có lỗi
    process.chdir(originalDir);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});