const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();
const PORT = 3000; 
// IMPORTANT: This secret must match the one you set in the GitHub webhook settings.
const WEBHOOK_SECRET = 'a7f9e3b2c1d5g6h8j4k5l6m7n8p9q0r1s2t3u4v5w6x7y8z9'; 
// Path to your deployment script (we will create this in the next step)
const DEPLOY_SCRIPT_PATH = '/root/Quant-ZenbotV2/deploy.sh'; 
const REPO_PATH = '/root/Quant-ZenbotV2'; 
const TARGET_BRANCH = 'refs/heads/main'; // Change to 'refs/heads/master' if your default branch is 'master'

// Middleware to parse JSON payloads
app.use(bodyParser.json());

// Function to verify the signature from GitHub
function verifyGitHubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('Webhook received without signature.');
    return res.status(401).send('No signature provided.');
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = Buffer.from('sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex'), 'utf8');
  const checksum = Buffer.from(signature, 'utf8');

  if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
    console.warn('Webhook received with invalid signature.');
    return res.status(401).send('Invalid signature.');
  }

  console.log('Webhook signature verified successfully.');
  next();
}

// Webhook endpoint
app.post('/webhook', verifyGitHubSignature, (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`Received GitHub event: ${event}`);

  if (event === 'ping') {
    console.log('Received ping event from GitHub. Setup successful!');
    return res.status(200).send('Ping received successfully.');
  }

  if (event === 'push') {
    console.log('Push event received.');
    // Check if the push was to the target branch (e.g., master)
    if (payload.ref === TARGET_BRANCH) {
      console.log(`Push to ${TARGET_BRANCH} detected. Triggering deployment...`);
      
      // Execute the deployment script
      // Replace the exec line with this more explicit version
      exec('/bin/bash ' + DEPLOY_SCRIPT_PATH, (error, stdout, stderr) => {
        if (error) {
          console.error(`Deployment script error: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          // Don't send error details back to GitHub for security, just log them.
          return res.status(500).send('Deployment script failed.');
        }
        console.log(`Deployment script stdout: ${stdout}`);
        if (stderr) {
            console.warn(`Deployment script stderr: ${stderr}`);
        }
        console.log('Deployment script executed successfully.');
        res.status(200).send('Push received and deployment triggered.');
      });
    } else {
      console.log(`Push was to branch ${payload.ref}, not ${TARGET_BRANCH}. Ignoring.`);
      res.status(200).send('Push received for non-target branch, ignored.');
    }
  } else {
    console.log(`Received unhandled event: ${event}. Ignoring.`);
    res.status(200).send('Event received but not processed.');
  }
});

app.listen(PORT, () => {
  console.log(`Webhook listener started on port ${PORT}`);
});