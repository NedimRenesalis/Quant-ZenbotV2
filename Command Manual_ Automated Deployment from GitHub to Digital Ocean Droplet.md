# Command Manual: Automated Deployment from GitHub to Digital Ocean Droplet

## Introduction

This manual provides a comprehensive, step-by-step guide to setting up an automated deployment pipeline. The goal is to automatically propagate code changes from your local development environment to a Digital Ocean droplet whenever you push these changes to a specific branch (in this case, `master`) in your GitHub repository. This setup will streamline your development workflow, allowing you to develop and test locally, push to GitHub for version control and collaboration, and then have those changes automatically deployed to your production or staging environment on the Digital Ocean droplet.

We will cover:

*   Generating and configuring SSH keys for secure communication between your Digital Ocean droplet and GitHub.
*   Setting up a GitHub webhook to notify your droplet of new pushes to the repository.
*   Creating a script on your droplet to listen for these webhook notifications, pull the latest code, install dependencies, and restart your application.
*   Installing necessary software (Node.js, MongoDB, Git) on your Ubuntu 22.04 droplet.
*   Cloning your Node.js application (Zenbot) and managing its configuration, including sensitive API keys.

This guide assumes you are using Ubuntu 22.04 on your Digital Ocean droplet and your application is the Zenbot trading bot, a Node.js application requiring MongoDB.

## Prerequisites

Before you begin, ensure you have the following:

1.  **Local Development Environment:** A Linux Ubuntu LTS 22 machine (or similar) with your project code and Git installed. You are using GitHub Desktop to push changes to GitHub.
2.  **GitHub Repository:** Your project (`DeviaVir/zenbot` or a fork) hosted on GitHub. You have administrative access to this repository to configure deploy keys and webhooks.
3.  **Digital Ocean Droplet:** An Ubuntu 22.04 droplet. You have root or sudo access to this droplet.
4.  **Basic Linux Command-Line Knowledge:** Familiarity with navigating the Linux shell and executing commands.
5.  **Domain Name (Optional but Recommended):** If you plan to use HTTPS for your webhook endpoint, a domain name pointing to your droplet\'s IP address will be helpful for SSL certificate setup. For simplicity, this guide will initially focus on an HTTP webhook, but security considerations for production will be mentioned.

Let\'s begin setting up your automated deployment pipeline!



## Step 1: Installing Required Software on Your Digital Ocean Droplet

Before we can clone your repository and set up the deployment script, we need to install the necessary software on your Ubuntu 22.04 droplet. This includes Git (for pulling code from GitHub), Node.js (to run your Zenbot application), and MongoDB (the database Zenbot uses).

Connect to your Digital Ocean droplet via SSH. If you\re unsure how, Digital Ocean provides excellent guides on this. Once connected, execute the following commands.

### 1.1 Update Package Lists

First, it\s always a good practice to update your server\s package list to ensure you\re getting the latest versions of software and security updates:

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Install Git

Git is essential for cloning your repository from GitHub and pulling updates.

```bash
sudo apt install git -y
```

To verify the installation, you can check the Git version:

```bash
git --version
```

### 1.3 Install Node.js (using Node Version Manager - NVM)

Zenbot is a Node.js application. While the repository doesn\t explicitly state a Node.js version, it\s an older project. Using Node Version Manager (NVM) is highly recommended as it allows you to install and manage multiple Node.js versions easily. This gives you flexibility if Zenbot requires a specific older version or if you want to upgrade in the future.

1.  **Install NVM:**
    Download and execute the NVM installation script. Check the [official NVM GitHub page](https://github.com/nvm-sh/nvm) for the very latest version of the install script command, as it can change.

    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
    *(Note: As of May 2025, `v0.39.7` is a recent version. Please verify the latest version from the NVM GitHub repository if you encounter issues.)*

2.  **Load NVM:**
    After the script runs, you\ll need to source your shell configuration file (e.g., `.bashrc`, `.zshrc`) or open a new terminal session for the `nvm` command to become available.

    ```bash
    source ~/.bashrc 
    ```
    *(If you are using a different shell like zsh, replace `.bashrc` with `~/.zshrc`)*

3.  **Verify NVM installation:**

    ```bash
    nvm --version
    ```
    This should output the NVM version number.

4.  **Install a Node.js LTS version:**
    Let\s install a recent Long-Term Support (LTS) version of Node.js. For example, Node.js 18.x (codename \'Gallium\' or later). You can list available LTS versions with `nvm ls-remote --lts` and install a specific one, for example, the latest LTS:

    ```bash
    nvm install --lts
    ```
    Or, if you need a specific version (e.g., if Zenbot has compatibility issues with the newest LTS, you might try an older one like 16.x):

    ```bash
    # Example: nvm install 16
    # nvm install 18 
    ```
    For Zenbot, which was last updated actively around 2020-2022, Node.js 14.x, 16.x, or 18.x would likely be suitable. Start with the latest LTS installed by `nvm install --lts` and troubleshoot if needed.

5.  **Set the default Node.js version:**
    To use the installed version by default in new shell sessions:

    ```bash
    nvm alias default lts/* # Or specify the version e.g., nvm alias default 18
    ```

6.  **Verify Node.js and npm installation:**

    ```bash
    node -v
npm -v
    ```
    These commands should display the installed versions of Node.js and npm (Node Package Manager), respectively.

### 1.4 Install MongoDB

Zenbot requires MongoDB as its database. We will install MongoDB Community Edition. The following steps are for Ubuntu 22.04 (Jammy Jellyfish) and are based on the official MongoDB documentation. Always refer to the [official MongoDB installation guide](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/) for the most up-to-date instructions.

1.  **Import the MongoDB public GPG Key:**

    ```bash
    sudo apt update
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
    ```
    *(Note: As of May 2025, MongoDB 7.0 is the current stable release. If this command fails or you prefer a different version, consult the official MongoDB documentation for the correct key and repository for your desired version and Ubuntu release.)*
    If you get an error about `apt-key` being deprecated, you can use the following method:
    ```bash
    sudo apt update
    sudo apt install gnupg curl
    curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    ```

2.  **Create a list file for MongoDB:**
    This command creates a sources list file for MongoDB. Ensure you are using the correct command for your Ubuntu version (22.04 Jammy in this case).

    Using the `apt-key add` method (older, might be deprecated):
    ```bash
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    ```
    Using the `gpg --dearmor` method (newer, preferred):
    ```bash
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    ```

3.  **Reload local package database:**

    ```bash
    sudo apt update
    ```

4.  **Install the MongoDB packages:**

    ```bash
    sudo apt install -y mongodb-org
    ```
    This will install the latest stable version of MongoDB, including the server (`mongod`), the shell (`mongosh`), and other tools.

5.  **Start and Enable MongoDB service:**
    Once installed, start the MongoDB service and enable it to start automatically on boot:

    ```bash
    sudo systemctl start mongod
sudo systemctl enable mongod
    ```

6.  **Verify MongoDB installation and status:**
    Check that MongoDB has started successfully:

    ```bash
    sudo systemctl status mongod
    ```
    You should see output indicating that the `mongod` service is active (running). Press `q` to exit the status view.

    You can also connect to MongoDB using the MongoDB shell:

    ```bash
    mongosh
    ```
    This should open the MongoDB shell. You can type `exit` or press `Ctrl+D` to leave the shell.

With Git, Node.js (via NVM), and MongoDB installed, your droplet is now prepared for the next steps in setting up the automated deployment for your Zenbot application.



## Step 2: Setting up SSH Access and Cloning the Repository

To securely clone your private GitHub repository and pull updates automatically, we will use SSH keys. This involves generating an SSH key pair on your Digital Ocean droplet and adding the public key as a "Deploy Key" to your GitHub repository. Deploy keys grant read-only (or optionally write) access to a single repository, which is ideal for automated deployment scripts.

### 2.1 Generate SSH Key Pair on the Droplet

1.  **Log in to your Digital Ocean droplet via SSH.**

2.  **Check for existing SSH keys:**
    Before generating a new key, check if you already have one you might want to use:
    ```bash
    ls -al ~/.ssh/id_*.pub
    ```
    If you see files like `id_rsa.pub`, `id_ed25519.pub`, or `id_ecdsa.pub`, you already have an SSH key. You can either use an existing one (ensure it\s not used for other critical access that might be compromised if this key is) or generate a new one specifically for this purpose. For this guide, we\ll generate a new one.

3.  **Generate a new SSH key pair:**
    We\ll use the `ssh-keygen` command. The Ed25519 algorithm is modern and secure. If your system doesn\t support Ed25519, RSA is a good alternative.

    ```bash
    ssh-keygen -t ed25519 -C "your_email@example.com_deploy_key_zenbot"
    ```
    Or, for an RSA key (if Ed25519 is not available or preferred):
    ```bash
    # ssh-keygen -t rsa -b 4096 -C "your_email@example.com_deploy_key_zenbot"
    ```
    *   Replace `"your_email@example.com_deploy_key_zenbot"` with a descriptive comment, like your email address followed by an identifier for the key\s purpose.

4.  **When prompted for a file to save the key:**
    It will suggest a default location like `/home/your_username/.ssh/id_ed25519`. You can press Enter to accept the default. If you want to name it differently (e.g., if you have multiple keys), you can specify a custom path like `/home/your_username/.ssh/zenbot_deploy_key`.
    For this guide, let\s assume you accept the default or choose a specific name like `id_ed25519_zenbot`:
    ```
    Enter file in which to save the key (/home/ubuntu/.ssh/id_ed25519): /home/ubuntu/.ssh/id_ed25519_zenbot 
    ```
    *(Replace `ubuntu` with your actual username on the droplet if it\s different.)*

5.  **When prompted for a passphrase:**
    ```
    Enter passphrase (empty for no passphrase):
    Enter same passphrase again:
    ```
    For automated scripts that need to use this key without manual intervention (like our deployment script), you **must press Enter twice to leave the passphrase empty**. If you set a passphrase, the script won\t be able to use the key automatically unless you use tools like `ssh-agent` to manage the passphrase, which adds complexity.

6.  **Verify key generation:**
    Two files will be created: the private key (e.g., `id_ed25519_zenbot`) and the public key (e.g., `id_ed25519_zenbot.pub`) in the `~/.ssh/` directory (or the custom path you specified).
    ```bash
    ls -l ~/.ssh/id_ed25519_zenbot*
    ```
    You should see both files. **Never share your private key!**

### 2.2 Add the Public SSH Key to Your GitHub Repository as a Deploy Key

Now, you need to add the *public* key to your GitHub repository\s settings.

1.  **Display the public key on your droplet:**
    Use the `cat` command to display the content of your public key file. Make sure to copy the entire output, starting with `ssh-ed25519` (or `ssh-rsa`) and ending with your comment.

    ```bash
    cat ~/.ssh/id_ed25519_zenbot.pub
    ```
    Select and copy the entire output of this command. It will look something like:
    `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHcohateverYourPublicKeyIs your_email@example.com_deploy_key_zenbot`

2.  **Navigate to your GitHub repository settings:**
    *   Open your web browser and go to your Zenbot GitHub repository (e.g., `https://github.com/YourUsername/zenbot`).
    *   Click on the "Settings" tab of your repository.

3.  **Go to "Deploy keys":**
    *   In the left sidebar of the repository settings, click on "Deploy keys" (it might be under the "Security" section).

4.  **Click "Add deploy key":**
    *   You\ll see a button labeled "Add deploy key". Click it.

5.  **Fill in the deploy key details:**
    *   **Title:** Give your key a descriptive title, for example, "DigitalOcean Droplet Zenbot Deploy" or "DO Droplet Ubuntu 22.04".
    *   **Key:** Paste the entire public key (that you copied from your droplet\s terminal) into the "Key" text area.
    *   **Allow write access:** For simply pulling code, you do **not** need to check "Allow write access". Leaving it unchecked provides better security (read-only access). If your deployment script needed to push tags or something similar (not common for this setup), you would check it.

6.  **Click "Add key":**
    Confirm by clicking the "Add key" button.

### 2.3 Configure SSH to Use the Correct Key (Optional but Recommended for Multiple Keys)

If you generated the key with a non-default name (e.g., `id_ed25519_zenbot` instead of `id_ed25519`), or if you have multiple SSH keys and want to ensure GitHub uses the correct one for this specific repository, you can create or edit your SSH config file (`~/.ssh/config`).

1.  **Open or create the SSH config file:**
    ```bash
    nano ~/.ssh/config
    ```

2.  **Add a host entry for GitHub:**
    Add the following lines to the file, replacing `your_username` and the `IdentityFile` path if you used a different key name:

    ```
    Host github.com
      HostName github.com
      User git
      IdentityFile ~/.ssh/id_ed25519_zenbot
      IdentitiesOnly yes
    ```
    *   `Host github.com`: This is an alias. You can make it more specific like `github.com-zenbot` if you need different keys for different GitHub interactions from the same server, but for a single deploy key, `github.com` is fine.
    *   `HostName github.com`: The actual hostname to connect to.
    *   `User git`: GitHub SSH connections always use the `git` user.
    *   `IdentityFile ~/.ssh/id_ed25519_zenbot`: **Crucially, point this to your private key file.**
    *   `IdentitiesOnly yes`: This tells SSH to only use the identity file specified here for this host, and not try other keys.

3.  **Save and close the file:**
    If using `nano`, press `Ctrl+X`, then `Y` to confirm, and Enter to save.

4.  **Set correct permissions for the config file:**
    ```bash
    chmod 600 ~/.ssh/config
    ```
    The SSH configuration file can contain sensitive information, so it should not be world-readable.

### 2.4 Test the SSH Connection to GitHub

Before cloning, test if your SSH key is correctly set up and recognized by GitHub:

```bash
ssh -T git@github.com
```

You might see a message like:
`The authenticity of host \'github.com (IP ADDRESS)\' can\'t be established.`
`ECDSA key fingerprint is SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.`
`Are you sure you want to continue connecting (yes/no/[fingerprint])?`

Type `yes` and press Enter. This will add GitHub\s public key to your droplet\s `known_hosts` file.

If successful, you should see a message like:
`Hi YourUsername/zenbot! You\'ve successfully authenticated, but GitHub does not provide shell access.`
*(Note: The username part might just be your general GitHub username, not necessarily tied to the specific deploy key message here, but the important part is "successfully authenticated".)*

If you see "Permission denied (publickey)", double-check:
*   The public key was copied correctly to GitHub without extra spaces or missing characters.
*   The `IdentityFile` in `~/.ssh/config` points to the correct *private* key file on your droplet.
*   Permissions on `~/.ssh` directory (should be `700`), private key file (should be `600`), and public key file (should be `644`).

### 2.5 Clone the Repository to Your Droplet

Now that SSH access is configured, you can clone your Zenbot repository.

1.  **Navigate to the directory where you want to store the application:**
    It\s good practice to keep web applications or services in a standard location like `/var/www/` or a dedicated directory in your user\s home directory. For this example, let\s use `/opt/zenbot` or `~/zenbot_app`.

    Let\s choose `/opt/zenbot`. You\ll likely need `sudo` to create and manage files here, or you can create it and then change its ownership to your user.

    ```bash
    sudo mkdir -p /opt/zenbot
    sudo chown your_username:your_username /opt/zenbot # Replace your_username with your actual username, e.g., ubuntu
    cd /opt/zenbot
    ```
    Alternatively, to clone into your home directory:
    ```bash
    # mkdir ~/zenbot_app
    # cd ~/zenbot_app
    ```
    For this guide, we\ll assume `/opt/zenbot` and that your current user (e.g., `ubuntu`) has ownership or write permissions to it.

2.  **Clone the repository using the SSH URL:**
    Go to your GitHub repository page. Click the green "<> Code" button, and make sure "SSH" is selected. Copy the SSH URL. It will look like `git@github.com:YourUsername/zenbot.git` (or `git@github.com:DeviaVir/zenbot.git` if you are cloning the original directly, though for deployment you usually fork it first).

    ```bash
    git clone git@github.com:DeviaVir/zenbot.git .
    ```
    *   Replace `git@github.com:DeviaVir/zenbot.git` with the SSH URL of *your* repository (the one where you added the deploy key).
    *   The `.` at the end tells Git to clone the repository contents directly into the current directory (`/opt/zenbot`), rather than creating a new subdirectory named `zenbot` inside it.

3.  **Verify the clone:**
    List the files in the directory:
    ```bash
    ls -la
    ```
    You should see the files and folders from your Zenbot repository.

Your repository is now cloned to your Digital Ocean droplet using a secure SSH connection facilitated by a deploy key. The next step will be to configure Zenbot itself, including handling its dependencies and sensitive API keys.



## Step 3: Configuring Zenbot and Managing Secrets

With the Zenbot code cloned to your droplet, the next crucial step is to configure it. This primarily involves setting up your exchange API keys and other trading parameters. The Zenbot repository includes a sample configuration file that you will copy and customize.

**Crucially, your API keys are highly sensitive. They must NEVER be committed to your GitHub repository.** We will create a configuration file on the droplet that is excluded from Git tracking.

### 3.1 Create Your Configuration File

1.  **Navigate to your Zenbot directory:**
    If you\re not already there, change to the directory where you cloned Zenbot:
    ```bash
    cd /opt/zenbot 
    ```
    *(Or `cd ~/zenbot_app` if you used that path)*

2.  **Copy the sample configuration file:**
    Zenbot provides a `conf-sample.js` file. Copy this to `conf.js`. The `conf.js` file is typically listed in Zenbot\s `.gitignore` file, meaning Git will ignore it, so your sensitive data won\t be accidentally committed.

    ```bash
    cp conf-sample.js conf.js
    ```

3.  **Verify `.gitignore`:**
    Ensure `conf.js` is indeed in your repository\s `.gitignore` file. You can check its content:
    ```bash
    cat .gitignore
    ```
    Look for a line that says `conf.js`. If it\s not there (unlikely for Zenbot, but good to check), add it:
    ```bash
    # echo "conf.js" >> .gitignore # Only if not already present
    ```

### 3.2 Edit the Configuration File (`conf.js`)

Now, you need to edit `conf.js` to input your API keys, select your exchange, currency pairs, and trading strategy.

1.  **Open `conf.js` for editing:**
    Use a text editor like `nano`:
    ```bash
    nano conf.js
    ```

2.  **Locate and configure API keys:**
    Scroll through the `conf.js` file. You will find sections for various exchanges. Find the section for the exchange(s) you plan to use (e.g., Binance, Kraken, etc.).

    You will typically see something like:
    ```javascript
    // c.kraken = {
    //   key: \'YOUR-API-KEY\',
    //   secret: \'YOUR-SECRET\',
    //   // passphrase: \'YOUR-PASSPHRASE\', // optional
    //   // pair_assets: [\'XBT\', \'EUR\'], // set this to your base currency (EUR/USD/BTC/ETH)
    //   // asset_pairs: [\'XBT/EUR\', \'ETH/EUR\'] // set this to the asset pairs you want to trade on
    // };
    ```
    *   **Uncomment** the section for your exchange by removing the `//` at the beginning of the lines.
    *   **Replace `YOUR-API-KEY` and `YOUR-SECRET`** with the actual API key and secret you obtained from your cryptocurrency exchange. Ensure there are no extra spaces.
    *   If your exchange requires a passphrase (like Coinbase Pro/GDAX used to, or some Kraken API key setups), uncomment and set that too.

3.  **Configure other essential parameters:**
    *   **`c.default_exchange`**: Set this to the string name of the exchange you primarily want to use (e.g., `c.default_exchange = \'binance\'`).
    *   **`c.default_selector`**: This defines the market (asset pair) Zenbot will trade. It\s usually in the format `EXCHANGE_NAME.ASSET-QUOTE_CURRENCY` (e.g., `c.default_selector = \'binance.BTC-USDT\'`). You\ll need to find the correct format for your exchange and pair within the `conf.js` or Zenbot documentation.
    *   **`c.paper`**: For initial testing without real funds, set `c.paper = true`. This enables paper trading mode. **For live trading with real money, you would set this to `c.paper = false` AFTER extensive testing and understanding the risks.**
    *   **`c.trade_log`**: Set `c.trade_log = true` to keep a log of trades.
    *   **Strategy settings**: Zenbot has various trading strategies. You\ll need to configure `c.strategy` and its associated parameters. This is beyond the scope of a simple deployment guide, but you\ll find these settings in `conf.js`. The default strategy is often `trend_ema` or similar.
    *   **MongoDB Configuration (`c.mongo`)**: The default MongoDB settings in `conf-sample.js` usually point to a local MongoDB instance (`mongodb://localhost:27017/zenbot4`) which we installed. These defaults should work if MongoDB is running correctly on the same droplet.

    Example snippet for Binance:
    ```javascript
    c.binance = {
      key: \'YOUR_BINANCE_API_KEY\',
      secret: \'YOUR_BINANCE_API_SECRET\'
    };
    // ... further down ...
    c.default_exchange = \'binance\';
    c.default_selector = \'binance.BTC-USDT\'; // Example, change to your desired pair
    c.strategy = \'trend_ema\'; // Example, choose your strategy
    ```

4.  **Save and close the file:**
    In `nano`, press `Ctrl+X`, then `Y` to confirm, and Enter to save.

### 3.3 Security of `conf.js`

*   **Permissions:** Ensure `conf.js` has restrictive permissions so only your user can read it.
    ```bash
    chmod 600 /opt/zenbot/conf.js
    ```
*   **Never Commit:** Double-check that `conf.js` is in `.gitignore` and is not tracked by Git. If you accidentally committed it in the past, you must remove it from your Git history (which is a more complex process) and rotate your API keys immediately.

### 3.4 Alternative: Environment Variables for Secrets (More Secure for some workflows)

While `conf.js` (if properly gitignored and permissioned) is a common way Zenbot handles configuration, for enhanced security or consistency with other Node.js applications, you might consider loading sensitive parts like API keys from environment variables. Zenbot itself might not directly support this out-of-the-box for all configuration options without modification, but it\s a best practice to be aware of.

If Zenbot or a wrapper script were to support it, you\d typically:
1.  Set environment variables on your droplet (e.g., in `~/.bashrc`, `~/.profile`, or an environment file loaded by a process manager like PM2).
    ```bash
    # Example for ~/.bashrc (then source ~/.bashrc)
    # export ZENBOT_KRAKEN_KEY="your_key"
    # export ZENBOT_KRAKEN_SECRET="your_secret"
    ```
2.  Modify `conf.js` or the Zenbot code to read these `process.env.ZENBOT_KRAKEN_KEY` variables.

For this guide, we will stick to the standard `conf.js` method as it\s directly supported by Zenbot. However, be extremely careful with the `conf.js` file.

### 3.5 Install Node.js Dependencies

Now that the code is cloned, you need to install the Node.js packages defined in `package.json` and `package-lock.json`.

1.  **Navigate to the Zenbot directory:**
    ```bash
    cd /opt/zenbot
    ```

2.  **Install dependencies:**
    It\s generally recommended to use `npm ci` if a `package-lock.json` file exists, as it provides faster, more reliable builds for CI/CD environments by installing exact versions from the lockfile. If `package-lock.json` is not present or you prefer `npm install` (which might update minor/patch versions based on `package.json`):

    ```bash
    npm ci 
    ```
    Or, if `npm ci` fails or you prefer `npm install`:
    ```bash
    # npm install
    ```
    This command will download and install all the necessary Node.js modules into a `node_modules` directory within `/opt/zenbot`.
    This step can take a few minutes, depending on the number of dependencies and your droplet\s resources.

After these steps, your Zenbot application is configured with your API keys (handle with care!) and its Node.js dependencies are installed. You should be able to manually run Zenbot commands from your droplet\s terminal to test if the configuration is correct before we automate the deployment and execution.

For example, to list available commands (after `npm install` or `npm ci` is complete):
```bash
./zenbot.sh list-commands
```
Or to test a paper trade (ensure MongoDB is running):
```bash
# ./zenbot.sh trade --paper
```
*(You might need to specify a selector if not fully configured in `conf.js`, e.g., `./zenbot.sh trade binance.BTC-USDT --paper`)*

Do not proceed with live trading until you are confident in your setup and have thoroughly tested with paper trading.



## Step 4: Setting up the GitHub Webhook

A GitHub webhook is a mechanism that allows GitHub to send real-time notifications to an external web server whenever certain events occur in your repository. In our case, we want GitHub to notify our Digital Ocean droplet whenever code is pushed to the `master` branch. Our droplet will then run a script to pull these changes and redeploy the application.

This step involves two main parts:
1.  **Creating a Webhook Listener on Your Droplet:** A small web server that listens for incoming HTTP POST requests from GitHub.
2.  **Configuring the Webhook in Your GitHub Repository:** Telling GitHub where to send these notifications (the URL of your listener) and under what conditions.

### 4.1 Creating a Simple Webhook Listener on the Droplet

We\ll create a basic Node.js server using Express to listen for webhook events. This server will verify the request from GitHub (using a secret) and then trigger our deployment script (which we will create in the next step).

1.  **Install Express (if not already a project dependency, or install globally for a standalone script):**
    Since Zenbot is a Node.js project, Express might already be available or you might prefer to keep this listener separate. For a standalone listener, you can create a new directory for it.

    Let\s create a dedicated directory for our webhook listener, for example, in your user\s home directory or alongside your Zenbot app if you prefer, but outside the Zenbot git repository itself to avoid conflicts.

    ```bash
    mkdir ~/webhook_listener
    cd ~/webhook_listener
    npm init -y # Initialize a new Node.js project
    npm install express body-parser crypto # Install necessary packages
    ```
    *   `express`: Web framework for Node.js.
    *   `body-parser`: Middleware to parse incoming request bodies (GitHub sends JSON payloads).
    *   `crypto`: Built-in Node.js module for cryptographic functions, used to verify the webhook signature.

2.  **Create the listener script (`webhook_server.js`):**
    Create a file named `webhook_server.js` in the `~/webhook_listener` directory:
    ```bash
    nano ~/webhook_listener/webhook_server.js
    ```
    Paste the following code into the file. **Read the comments carefully and adjust parameters like `YOUR_SECRET_TOKEN`, `YOUR_DEPLOY_SCRIPT_PATH`, and `YOUR_REPO_PATH`**. 

    ```javascript
    const express = require(\'express\');
    const bodyParser = require(\'body-parser\');
    const crypto = require(\'crypto\');
    const { exec } = require(\'child_process\');

    const app = express();
    const PORT = 3000; // Choose a port for your webhook listener, e.g., 3000, 8080, etc.
    // IMPORTANT: This secret must match the one you set in the GitHub webhook settings.
    const WEBHOOK_SECRET = \'YOUR_VERY_SECRET_TOKEN\'; // REPLACE WITH A STRONG, RANDOM SECRET
    // Path to your deployment script (we will create this in the next step)
    const DEPLOY_SCRIPT_PATH = \'/opt/zenbot/deploy.sh\'; // REPLACE WITH THE ACTUAL PATH TO YOUR DEPLOY SCRIPT
    // Path to your repository, for context in the deploy script if needed
    const REPO_PATH = \'/opt/zenbot\'; // REPLACE WITH YOUR REPO PATH
    const TARGET_BRANCH = \'refs/heads/master\'; // Deploy only on pushes to the master branch

    // Middleware to parse JSON payloads
    app.use(bodyParser.json());

    // Function to verify the signature from GitHub
    function verifyGitHubSignature(req, res, next) {
      const signature = req.headers[\'x-hub-signature-256\'];
      if (!signature) {
        console.warn(\'Webhook received without signature.\');
        return res.status(401).send(\'No signature provided.\');
      }

      const hmac = crypto.createHmac(\'sha256\', WEBHOOK_SECRET);
      const digest = Buffer.from(\'sha256=\' + hmac.update(JSON.stringify(req.body)).digest(\'hex\'), \'utf8\');
      const checksum = Buffer.from(signature, \'utf8\');

      if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
        console.warn(\'Webhook received with invalid signature.\');
        return res.status(401).send(\'Invalid signature.\');
      }

      console.log(\'Webhook signature verified successfully.\');
      next();
    }

    // Webhook endpoint
    app.post(\'/webhook\', verifyGitHubSignature, (req, res) => {
      const event = req.headers[\'x-github-event\'];
      const payload = req.body;

      console.log(`Received GitHub event: ${event}`);

      if (event === \'ping\') {
        console.log(\'Received ping event from GitHub. Setup successful!\');
        return res.status(200).send(\'Ping received successfully.\');
      }

      if (event === \'push\') {
        console.log(\'Push event received.\');
        // Check if the push was to the target branch (e.g., master)
        if (payload.ref === TARGET_BRANCH) {
          console.log(`Push to ${TARGET_BRANCH} detected. Triggering deployment...`);
          
          // Execute the deployment script
          // Pass the repository path as an argument or environment variable if the script needs it
          exec(`sh ${DEPLOY_SCRIPT_PATH} ${REPO_PATH}`, (error, stdout, stderr) => {
            if (error) {
              console.error(`Deployment script error: ${error.message}`);
              console.error(`stderr: ${stderr}`);
              // Don\'t send error details back to GitHub for security, just log them.
              return res.status(500).send(\'Deployment script failed.\');
            }
            console.log(`Deployment script stdout: ${stdout}`);
            if (stderr) {
                console.warn(`Deployment script stderr: ${stderr}`);
            }
            console.log(\'Deployment script executed successfully.\');
            res.status(200).send(\'Push received and deployment triggered.\');
          });
        } else {
          console.log(`Push was to branch ${payload.ref}, not ${TARGET_BRANCH}. Ignoring.`);
          res.status(200).send(\'Push received for non-target branch, ignored.\');
        }
      } else {
        console.log(`Received unhandled event: ${event}. Ignoring.`);
        res.status(200).send(\'Event received but not processed.\');
      }
    });

    app.listen(PORT, () => {
      console.log(`Webhook listener started on port ${PORT}`);
    });
    ```
    **Key things to customize in `webhook_server.js`:**
    *   `PORT`: Choose an available port (e.g., 3000). Ensure this port is open in your droplet\'s firewall if you have one configured (e.g., UFW).
    *   `WEBHOOK_SECRET`: **Generate a strong, random string for this.** You can use a password generator. This same secret will be entered into GitHub\'s webhook settings. **Do not use a weak secret.**
    *   `DEPLOY_SCRIPT_PATH`: The absolute path to the deployment script we will create in the next step (e.g., `/opt/zenbot/deploy.sh` or `~/webhook_listener/deploy.sh`).
    *   `REPO_PATH`: The absolute path to your cloned Zenbot repository (e.g., `/opt/zenbot`).
    *   `TARGET_BRANCH`: Set to `refs/heads/master` to only deploy on pushes to the `master` branch. If you use a different branch like `main`, change it to `refs/heads/main`.

3.  **Save the `webhook_server.js` file** (Ctrl+X, Y, Enter in nano).

4.  **Test running the listener (optional, for now):**
    You can try running it with `node webhook_server.js`. It will log "Webhook listener started on port [PORT]". You\'ll need to make it run persistently later (e.g., using PM2).

### 4.2 Exposing the Webhook Listener to the Internet

GitHub needs to be able to send requests to your webhook listener. This means the port your listener is running on (e.g., 3000) must be accessible from the public internet.

*   **Firewall:** If you are using a firewall on your Digital Ocean droplet (like UFW), you need to allow incoming connections on the chosen port.
    ```bash
    sudo ufw allow 3000/tcp # Replace 3000 with your chosen port
    sudo ufw reload
    sudo ufw status # To verify
    ```
*   **Public IP Address:** You will use your droplet\'s public IP address in the GitHub webhook configuration.

*   **Security Note (HTTPS):** For production, it is **highly recommended** to serve your webhook listener over HTTPS. This encrypts the data (including the payload) between GitHub and your server. Setting up HTTPS typically involves using a reverse proxy like Nginx or Caddy with an SSL certificate (e.g., from Let\'s Encrypt). This guide focuses on the HTTP setup for simplicity, but be aware of this for a production environment. If using a reverse proxy, GitHub would connect to port 443 (HTTPS) on your proxy, which then forwards the request to your Node.js listener on its local port (e.g., 3000).

### 4.3 Configuring the Webhook in Your GitHub Repository

1.  **Go to your GitHub repository settings:**
    *   Open your web browser and navigate to your Zenbot GitHub repository.
    *   Click on the "Settings" tab.

2.  **Navigate to "Webhooks":**
    *   In the left sidebar, click on "Webhooks" (under "Code and automation" or similar section).

3.  **Click "Add webhook":**
    *   You\'ll see a button labeled "Add webhook". Click it.

4.  **Fill in the webhook configuration form:**

    *   **Payload URL:** This is the public URL where your webhook listener is running. It will be `http://YOUR_DROPLET_IP_ADDRESS:PORT/webhook`.
        *   Replace `YOUR_DROPLET_IP_ADDRESS` with your Digital Ocean droplet\'s public IP address.
        *   Replace `PORT` with the port number you configured in `webhook_server.js` (e.g., 3000).
        *   Example: `http://123.45.67.89:3000/webhook`

    *   **Content type:** Select `application/json` from the dropdown.

    *   **Secret:** This is **critical for security**. Enter the exact same strong, random string you used for `WEBHOOK_SECRET` in your `webhook_server.js` file. GitHub will use this secret to sign the webhook payloads it sends. Your server will then use the same secret to verify that the payload genuinely came from GitHub and hasn\'t been tampered with.

    *   **Which events would you like to trigger this webhook?**
        *   Select "Let me select individual events."
        *   Uncheck "Pushes" initially (as it defaults to all branches).
        *   Scroll down and find "Pushes" in the list of individual events and **check it**. This ensures the webhook only triggers on push events. The script itself further filters for the `master` branch.
        *   (Alternatively, some setups might use the "Branch or tag creation" or "Releases" events, but for your described workflow, "Pushes" is appropriate. The script `webhook_server.js` already filters for pushes to the `master` branch specifically from the payload.)

    *   **Active:** Ensure this checkbox is checked to enable the webhook.

5.  **Click "Add webhook":**
    GitHub will immediately try to send a "ping" event to your Payload URL. If your `webhook_server.js` is running and accessible, you should see a green checkmark next to the webhook in your GitHub settings, and your `webhook_server.js` console will log "Received ping event from GitHub."

### 4.4 Troubleshooting Webhook Delivery

If GitHub shows a red X or an error for the webhook delivery (check the "Recent Deliveries" tab for your webhook in GitHub settings):

*   **Listener Running?** Ensure your `webhook_server.js` is actually running on the droplet: `node ~/webhook_listener/webhook_server.js` (we\'ll use PM2 later to keep it running).
*   **Firewall?** Double-check that the port is open in your droplet\'s firewall (e.g., `sudo ufw status`).
*   **Correct IP and Port?** Verify the Payload URL in GitHub has the correct public IP address of your droplet and the correct port number.
*   **Path Correct?** Ensure the path in the Payload URL is `/webhook` as defined in `webhook_server.js`.
*   **Server Logs:** Check the console output of `webhook_server.js` on your droplet for any error messages. If it\'s crashing, there might be a typo or issue in the script.
*   **Secret Mismatch?** While a secret mismatch won\'t prevent the ping (which isn\'t signed the same way as push events), it will cause actual push events to be rejected by your script. Ensure the secrets match exactly.
*   **Body Parser:** Ensure `body-parser` is correctly parsing the JSON. The provided script includes this.

Once the initial ping is successful, your GitHub repository is configured to notify your droplet. The next step is to create the `deploy.sh` script that `webhook_server.js` will execute.



## Step 5: Creating the Automated Deployment Script on the Droplet (`deploy.sh`)

This script is the heart of the automated deployment process on your droplet. It will be executed by the `webhook_server.js` listener whenever a valid push event to the `master` branch is received from GitHub. Its responsibilities include fetching the latest code, installing any new dependencies, and restarting your Zenbot application.

### 5.1 Script Location and Permissions

1.  **Choose a location for the script:**
    In our `webhook_server.js`, we referred to the script as `/opt/zenbot/deploy.sh`. Let\s create it there. This keeps it within the application\s main directory, but ensure it\s not accidentally committed to Git if you don\t want it version-controlled (though deployment scripts are often version-controlled for tracking changes to the deployment process itself).

    If `/opt/zenbot/deploy.sh` is inside your Git repository, make sure you are happy with that. If not, you could place it in `~/webhook_listener/deploy.sh` or `/usr/local/bin/deploy_zenbot.sh`. For this guide, we\ll stick to `/opt/zenbot/deploy.sh` as defined in the webhook listener.

2.  **Create the script file:**
    Navigate to your Zenbot directory (or the chosen location) and create `deploy.sh`:
    ```bash
    cd /opt/zenbot 
    nano deploy.sh
    ```

3.  **Make the script executable:**
    After saving the script content, you must make it executable:
    ```bash
    chmod +x /opt/zenbot/deploy.sh
    ```

### 5.2 The Deployment Script (`deploy.sh`)

Paste the following Bash script content into `/opt/zenbot/deploy.sh`. Read through the comments to understand each part and customize it if necessary, especially the application restart section.

```bash
#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define Repository Path (adjust if your script is not in the repo root)
REPO_PATH="/opt/zenbot" # Or dynamically get it: REPO_PATH=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LOG_FILE="/opt/zenbot/deploy.log" # Optional: Log output to a file

# Function for logging with timestamp
log() {
  echo "$(date 				'+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "Starting deployment script..."

# Navigate to the repository directory
cd "$REPO_PATH" || {
  log "Error: Repository path $REPO_PATH not found."
  exit 1
}
log "Successfully navigated to $REPO_PATH"

# Ensure we are on the master branch (or your deployment branch)
# This is a safety check; the webhook listener should already filter.
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "master" ]; then
  log "Warning: Not on master branch (current: $CURRENT_BRANCH). Attempting to checkout master..."
  git checkout master || {
    log "Error: Failed to checkout master branch."
    exit 1
  }
fi
log "Currently on master branch."

# Optional: Stash any local changes to avoid conflicts during pull
# Use with caution: this will discard any uncommitted changes on the server.
# git stash push -u -m "Auto-stash before deployment $(date)"
# log "Stashed local changes (if any)."

# Pull the latest changes from the master branch of the remote repository (origin)
log "Pulling latest changes from origin master..."
git pull origin master || {
  log "Error: Failed to pull from origin master."
  # Optional: Try to pop stash if you stashed before
  # if git stash list | grep -q "Auto-stash before deployment"; then git stash pop; fi
  exit 1
}
log "Successfully pulled latest changes."

# Optional: Pop stash if you stashed before and pull was successful
# if git stash list | grep -q "Auto-stash before deployment"; then 
#   log "Popping stashed changes..."
#   git stash pop || log "Warning: Failed to pop stash. Manual intervention may be needed."
# fi

# Install/update Node.js dependencies
# Using npm ci is generally recommended for CI/CD as it uses package-lock.json for deterministic builds.
log "Installing/updating Node.js dependencies with npm ci..."
npm ci || {
  log "Error: npm ci failed. Attempting npm install..."
  npm install || {
    log "Error: npm install also failed."
    exit 1
  }
}
log "Node.js dependencies installed/updated successfully."

# Restarting the Zenbot Application
# This is the most application-specific part.
# Zenbot is a command-line tool. You need a way to run it persistently and restart it.
# PM2 (Process Manager 2) is highly recommended for Node.js applications.

log "Attempting to restart Zenbot application..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null
then
    log "PM2 could not be found. Attempting to install PM2 globally..."
    # This assumes NVM is set up correctly for the user running this script
    # May require sudo if installing globally for all users, or configure npm prefix for user installs
    npm install pm2 -g || {
        log "Error: Failed to install PM2. Please install PM2 manually and configure Zenbot to run with it."
        exit 1
    }
    log "PM2 installed successfully. You may need to set it up to start on boot: pm2 startup"
fi

# Define your Zenbot application name in PM2 (choose a descriptive name)
PM2_APP_NAME="zenbot_trader"

# Check if the application is already managed by PM2
if pm2 describe "$PM2_APP_NAME" &> /dev/null; then
  log "Zenbot ($PM2_APP_NAME) is already managed by PM2. Attempting to restart it..."
  # The command to run Zenbot. Adjust selector, paper/live mode, etc., as per your conf.js or needs.
  # Example: ./zenbot.sh trade --paper (ensure conf.js has the selector)
  # Or: ./zenbot.sh trade binance.BTC-USDT --paper
  # For PM2, it\s better to use the full path to zenbot.sh or ensure PATH is set correctly.
  # The `pm2 restart` command will restart the existing process.
  # If you need to change the command Zenbot runs, you might need to delete and restart:
  # pm2 delete "$PM2_APP_NAME"
  # pm2 start ./zenbot.sh --name "$PM2_APP_NAME" -- trade your_selector --paper_or_live_options
  
  pm2 restart "$PM2_APP_NAME" || {
    log "Error: Failed to restart Zenbot ($PM2_APP_NAME) with PM2."
    # As a fallback, try to start if it failed to restart (e.g., if it was stopped)
    log "Attempting to start Zenbot ($PM2_APP_NAME) with PM2 as a fallback..."
    # Ensure you adjust the Zenbot command as needed!
    pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper || {
        log "Critical Error: Failed to start Zenbot ($PM2_APP_NAME) with PM2."
        exit 1
    }
  }
else
  log "Zenbot ($PM2_APP_NAME) is not yet managed by PM2. Attempting to start it for the first time..."
  # Adjust the command for Zenbot. Example: trade with paper trading.
  # The `--interpreter bash` is important if zenbot.sh is a shell script.
  # Make sure your conf.js is set up for the desired exchange/pair or specify it here.
  pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper || {
    log "Error: Failed to start Zenbot ($PM2_APP_NAME) with PM2 for the first time."
    exit 1
  }
  log "Zenbot ($PM2_APP_NAME) started with PM2. Consider running 'pm2 save' and 'pm2 startup' to ensure it persists reboots."
fi

log "Zenbot application restart/start command issued via PM2."

# Optional: Add any other post-deployment tasks here
# e.g., clearing cache, running database migrations (if applicable)

log "Deployment script finished successfully."
exit 0
```

**Explanation of the `deploy.sh` script:**

*   `#!/bin/bash`: Shebang, specifies the interpreter for the script.
*   `set -e`: Exits the script immediately if any command fails. This is important for preventing partial or broken deployments.
*   `REPO_PATH`: Defines the path to your Zenbot repository. The example tries to dynamically determine it if the script is in the repo root, or you can hardcode it.
*   `LOG_FILE`: Specifies a file where deployment logs will be appended.
*   `log()`: A simple function to print messages with a timestamp to both console and the log file.
*   `cd "$REPO_PATH"`: Navigates to the repository directory. Exits if the path is not found.
*   `git rev-parse --abbrev-ref HEAD`: Checks the current branch. It attempts to switch to `master` if not already on it. This is a safeguard.
*   `git pull origin master`: Fetches the latest changes from the `master` branch of your GitHub repository (assuming your remote is named `origin`).
*   `npm ci || npm install`: Installs Node.js dependencies. `npm ci` is preferred for speed and reliability as it uses `package-lock.json`. If it fails, it falls back to `npm install`.
*   **PM2 Section (Application Restart):**
    *   It checks if PM2 is installed. If not, it attempts to install it globally using `npm install pm2 -g`. *Note: Global npm installs might require `sudo` or specific npm prefix configuration if the script isn\t run as root or the user doesn\t have permissions to the global npm directory. The user running the webhook listener (and thus this script) needs appropriate permissions.* Consider installing PM2 manually beforehand as part of the initial server setup.
    *   `PM2_APP_NAME`: A name you assign to your Zenbot process within PM2 (e.g., `zenbot_trader`).
    *   `pm2 describe "$PM2_APP_NAME"`: Checks if Zenbot is already running under PM2 with that name.
    *   `pm2 restart "$PM2_APP_NAME"`: If it\s running, this command gracefully restarts it. PM2 will update the code and restart the process.
    *   `pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper`: If it\s not running, this command starts Zenbot using `zenbot.sh`. 
        *   `--name "$PM2_APP_NAME"`: Assigns the name in PM2.
        *   `--interpreter bash`: Tells PM2 to run `zenbot.sh` using bash.
        *   `-- trade --paper`: These are arguments passed to `zenbot.sh`. **You MUST customize this part** to match how you want to run Zenbot (e.g., `trade your_exchange.ASSET-QUOTE --paper` or `trade --live` if you are ready for live trading and have configured `conf.js` accordingly). For initial setup, `--paper` is safest.
    *   The script includes basic error handling for PM2 commands.
*   `log "Deployment script finished successfully."`: Final log message.

### 5.3 Customizing the Zenbot Start Command in `deploy.sh`

The most critical part to customize in `deploy.sh` is the `pm2 start` command:

```bash
# pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper 
# Replace '-- trade --paper' with your actual Zenbot command and arguments.
# Examples:
# To trade BTC/USDT on Binance in paper mode (if conf.js default_selector is not set or you want to override):
# pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade binance.BTC-USDT --paper
#
# To run based on conf.js settings (assuming it\s configured for paper trading initially):
# pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper
#
# For live trading (USE WITH EXTREME CAUTION AND AFTER THOROUGH TESTING):
# pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade your_exchange.ASSET-QUOTE --live_options_if_any
```
Ensure the command you use with `pm2 start` is the one you would use to manually start Zenbot from the command line for your desired trading activity.

### 5.4 User Permissions for the Deployment Script

The user that runs the `webhook_server.js` (and therefore this `deploy.sh` script) needs:
*   Permission to write to the log file (e.g., `/opt/zenbot/deploy.log`).
*   Permission to execute `git` commands in the `/opt/zenbot` directory (usually the owner of the directory).
*   Permission to run `npm` commands (which might involve writing to `node_modules`).
*   Permission to run `pm2` commands. If PM2 is installed globally and the user is not root, they might need to be part of a group that can manage PM2, or PM2 might need to be set up for that user.
*   If installing PM2 globally within the script (`npm install pm2 -g`), this user needs permission to write to the global Node modules directory. It\s often better to ensure PM2 is pre-installed by an administrator.

It\s common to run the webhook listener (and thus this script) as a dedicated non-root user who owns the application files (e.g., the `ubuntu` user if it owns `/opt/zenbot`).

With `deploy.sh` created and made executable, and your `webhook_server.js` pointing to it, the core components for automated deployment are in place. The next steps are to ensure the webhook listener runs persistently and then to test the entire flow.



## Step 6: Testing the Webhook and Automated Deployment

With all components configured – the SSH keys, the cloned repository, Zenbot configuration, the webhook listener (`webhook_server.js`), and the deployment script (`deploy.sh`) – it\s time to test the entire automated pipeline. This involves making a change to your local repository, pushing it to GitHub, and observing if it automatically deploys to your Digital Ocean droplet.

### 6.1 Make the Webhook Listener Persistent with PM2

Our `webhook_server.js` needs to run continuously to listen for notifications from GitHub. We\ll use PM2, the same process manager we plan to use for Zenbot itself.

1.  **Ensure PM2 is installed globally:**
    We included a check and an attempt to install PM2 in `deploy.sh`. However, it\s best to ensure it\s properly installed and configured beforehand.
    ```bash
    sudo npm install pm2 -g
    ```
    If you installed Node.js via NVM for a specific user and not globally for root, you might not need `sudo` if your global npm directory is user-writable. However, for system-wide availability, `sudo` is common.

2.  **Start the webhook listener with PM2:**
    Navigate to the directory where your `webhook_server.js` is located (e.g., `~/webhook_listener`).
    ```bash
    cd ~/webhook_listener 
    ```
    Start the server using PM2. Give it a descriptive name.
    ```bash
    pm2 start webhook_server.js --name "zenbot_webhook_listener"
    ```
    *   `--name "zenbot_webhook_listener"`: Assigns a name to this process in PM2.

3.  **Check PM2 status:**
    Verify that the listener is running:
    ```bash
    pm2 status
    # or specifically for the listener:
    # pm2 describe zenbot_webhook_listener
    ```
    You should see `zenbot_webhook_listener` in the list with an "online" status.

4.  **View logs for the listener (optional but useful for debugging):**
    ```bash
    pm2 logs zenbot_webhook_listener
    ```
    This will show console output from `webhook_server.js`, including any connection attempts or errors. Press `Ctrl+C` to stop viewing logs.

5.  **Enable PM2 to start on system boot (IMPORTANT):**
    To ensure your webhook listener (and eventually Zenbot) restarts automatically if the droplet reboots, generate and configure the PM2 startup script:
    ```bash
    pm2 startup
    ```
    This command will output another command that you need to copy and run (it usually involves `sudo`). This command registers PM2 as a system service.
    After running the command provided by `pm2 startup`, save the current PM2 process list:
    ```bash
    pm2 save
    ```

Your webhook listener should now be running persistently.

### 6.2 Prepare for the Test Deployment

Before you push a change, quickly verify a few things on your droplet:

*   **MongoDB is running:** `sudo systemctl status mongod` (should be active).
*   **Initial Zenbot state (if you ran it manually):** If you manually started Zenbot with PM2 (e.g., `pm2 start /opt/zenbot/zenbot.sh --name zenbot_trader ...`), note its current status. The deployment script should restart it.
*   **Current commit:** In your Zenbot directory (`/opt/zenbot`), check the latest commit:
    ```bash
    cd /opt/zenbot
    git log -1 --oneline
    ```
    Note down the commit hash. This will help you confirm that new code is pulled.

### 6.3 Trigger the Deployment: Push a Change to GitHub

Now, simulate a typical development workflow:

1.  **Make a small, identifiable code change on your local machine** in your Zenbot repository. This could be adding a comment, modifying a non-critical text file, or a minor code adjustment. For example, you could add a new line to the `README.md` file.

2.  **Commit the change:**
    Use your usual Git workflow (e.g., `git add .`, `git commit -m "Test: Automated deployment trigger"`).

3.  **Push the change to the `master` branch on GitHub:**
    ```bash
    git push origin master
    ```
    (Or use GitHub Desktop as per your usual workflow to push to the `master` branch).

### 6.4 Monitor the Automated Deployment Process

As soon as GitHub receives the push, it should send a notification to your webhook listener.

1.  **Check GitHub Webhook Deliveries:**
    *   Go to your GitHub repository -> Settings -> Webhooks.
    *   Click on your configured webhook.
    *   Look at the "Recent Deliveries" tab. You should see a new delivery attempt for your push event. Hopefully, it has a green checkmark and a `200 OK` response status. If it\s red, click on it to see the request and response details, which can help diagnose issues (e.g., your listener wasn\t reachable, or it returned an error).

2.  **Check Webhook Listener Logs (PM2):**
    On your droplet, view the logs for your webhook listener:
    ```bash
    pm2 logs zenbot_webhook_listener
    ```
    You should see entries like:
    *   `Received GitHub event: push`
    *   `Push to refs/heads/master detected. Triggering deployment...`
    *   `Webhook signature verified successfully.`
    *   `Deployment script executed successfully.` (if `deploy.sh` ran without errors sent back to the listener)

3.  **Check Deployment Script Logs (`deploy.log`):**
    Open the log file you defined in `deploy.sh` (e.g., `/opt/zenbot/deploy.log`):
    ```bash
    tail -f /opt/zenbot/deploy.log
    ```
    You should see the detailed steps from your `deploy.sh` script being executed:
    *   Navigating to the repository.
    *   Pulling changes from Git.
    *   Installing Node.js dependencies (`npm ci` or `npm install`).
    *   PM2 commands for restarting Zenbot.

4.  **Check Zenbot Application Logs (PM2):**
    If your `deploy.sh` script restarts Zenbot using PM2 (e.g., `pm2 restart zenbot_trader`), check its logs:
    ```bash
    pm2 logs zenbot_trader
    ```
    Look for indications that the application restarted and is running correctly. Zenbot usually logs its startup sequence, connection to MongoDB, and selected exchange/pair.

### 6.5 Verify the Changes on the Droplet

1.  **Verify New Code:**
    Navigate to your Zenbot application directory on the droplet (`/opt/zenbot`):
    ```bash
    cd /opt/zenbot
    git log -1 --oneline
    ```
    The commit hash shown should now match the new commit you just pushed from your local machine. You can also check the content of the file you modified (e.g., `cat README.md`) to see your change.

2.  **Verify Dependencies (Optional):**
    If your pushed change involved adding or updating dependencies in `package.json`, you can check the `node_modules` directory timestamp or look for specific packages.

3.  **Verify Zenbot Application Status:**
    Check PM2 to ensure Zenbot is running:
    ```bash
    pm2 status
    ```
    The `zenbot_trader` process should be online, and its uptime should reflect a recent restart.

### 6.6 Troubleshooting Common Testing Issues

*   **Webhook Not Triggered or Failing on GitHub Side:**
    *   **Payload URL:** Double-check the IP, port, and `/webhook` path in GitHub settings.
    *   **Firewall:** Ensure your droplet\s firewall (e.g., UFW) allows incoming connections on the listener\s port.
    *   **Listener Not Running:** Use `pm2 status` to confirm `zenbot_webhook_listener` is online. Check its logs (`pm2 logs zenbot_webhook_listener`) for crashes or errors during startup.
    *   **Secret Mismatch:** If the GitHub delivery log shows a successful request but your listener log shows "Invalid signature," the `WEBHOOK_SECRET` in `webhook_server.js` and GitHub settings do not match.

*   **Deployment Script (`deploy.sh`) Fails:**
    *   **Permissions:** The user running `webhook_server.js` (and thus `deploy.sh`) might lack permissions for `git pull`, `npm install`, writing to logs, or executing `pm2` commands. Check the `deploy.log` for permission denied errors.
    *   **Script Errors:** Syntax errors in `deploy.sh` or commands within it failing. The `set -e` line should cause the script to exit on error. Examine `deploy.log` carefully for which command failed.
    *   **Git Pull Conflicts:** If there were manual, uncommitted changes made directly on the server in the `/opt/zenbot` directory, `git pull` might fail. The `deploy.sh` example doesn\t automatically handle complex merge conflicts (it optionally includes `git stash`). It\s best practice to avoid making manual changes on the server in a directory managed by automated deployment.
    *   **NPM Install Failures:** Network issues, incompatible Node.js version for a new dependency, or a corrupted `package-lock.json`. Check `deploy.log`.
    *   **PM2 Command Failures:** Zenbot application might be crashing on startup due to bad configuration in `conf.js` or code errors. Check `pm2 logs zenbot_trader` for application-specific errors.
    *   **Paths:** Ensure all paths in `webhook_server.js` (to `deploy.sh`) and in `deploy.sh` (to `REPO_PATH`, `LOG_FILE`) are correct absolute paths.

*   **Changes Pulled, but Application Not Behaving as Expected:**
    *   This could be an issue with the Zenbot application code itself or its configuration, rather than the deployment process. Debug Zenbot directly using its logs (`pm2 logs zenbot_trader`) and by testing its commands manually.

Successful completion of these testing steps indicates your automated deployment pipeline is working! You can now develop locally, push to GitHub, and have your changes automatically reflected on your Digital Ocean droplet.

## Step 7: Running and Managing Zenbot with PM2

While the `deploy.sh` script handles starting or restarting Zenbot via PM2 during deployments, you will also need to manage the Zenbot process at other times (e.g., checking its status, viewing logs, stopping/starting it manually). PM2 provides a robust way to do this.

### 7.1 Basic PM2 Commands for Zenbot

Assuming you named your Zenbot process `zenbot_trader` (as in the `deploy.sh` script example) and your webhook listener `zenbot_webhook_listener`:

*   **List all processes managed by PM2:**
    ```bash
    pm2 list
    # or
    # pm2 status
    ```
    This will show `zenbot_trader` and `zenbot_webhook_listener`, their status (online, stopped, errored), uptime, CPU/memory usage, etc.

*   **View logs for Zenbot:**
    ```bash
    pm2 logs zenbot_trader
    ```
    This streams the live logs. You can see Zenbot\s trading activity, errors, or other messages. Press `Ctrl+C` to exit log streaming.
    To view logs for the webhook listener:
    ```bash
    pm2 logs zenbot_webhook_listener
    ```

*   **Stop Zenbot:**
    ```bash
    pm2 stop zenbot_trader
    ```

*   **Start Zenbot (if stopped):**
    The `deploy.sh` script uses a specific `pm2 start` command with arguments. If you stop it and need to start it manually with the same parameters, you might need to re-issue that full command or configure a PM2 ecosystem file (see below).
    However, if it was just stopped, `pm2 start zenbot_trader` might work if PM2 remembers the original start command. Otherwise:
    ```bash
    # cd /opt/zenbot # Ensure you are in the correct directory if using relative paths in the command
    # pm2 start ./zenbot.sh --name zenbot_trader --interpreter bash -- trade --paper # Or your specific Zenbot command
    ```

*   **Restart Zenbot:**
    ```bash
    pm2 restart zenbot_trader
    ```
    This is useful if you manually change `conf.js` and want Zenbot to pick up the new settings without a full Git push deployment.

*   **Delete Zenbot from PM2 management:**
    If you want to remove Zenbot from PM2 (e.g., to reconfigure its start command completely):
    ```bash
    pm2 delete zenbot_trader
    ```
    After deleting, you would use the full `pm2 start ...` command again to add it back.

*   **Monitor Zenbot resources:**
    ```bash
    pm2 monit
    ```
    This provides a live dashboard in your terminal showing CPU and memory usage for all PM2-managed processes.

### 7.2 Using a PM2 Ecosystem File (Recommended for Complex Configurations)

For more complex applications or to better manage start-up configurations, PM2 supports an "ecosystem file" (usually `ecosystem.config.js`). This JavaScript file allows you to define all configuration options for your applications in one place.

1.  **Create `ecosystem.config.js` in your Zenbot directory (`/opt/zenbot`):**
    ```bash
    cd /opt/zenbot
    nano ecosystem.config.js
    ```

2.  **Add configuration for Zenbot and the webhook listener:**

    ```javascript
    module.exports = {
      apps : [
        {
          name: "zenbot_trader",
          script: "./zenbot.sh", // Path to zenbot.sh relative to cwd
          args: "trade --paper", // YOUR ZENBOT ARGUMENTS HERE (e.g., "trade binance.BTC-USDT --paper")
          cwd: "/opt/zenbot/",    // The directory where Zenbot is located
          interpreter: "bash",
          max_memory_restart: "500M", // Optional: Restart if it exceeds memory limit
          env: {
            NODE_ENV: "production", // Or "development"
            // You can define other environment variables Zenbot might need here
          }
        },
        {
          name: "zenbot_webhook_listener",
          script: "/home/ubuntu/webhook_listener/webhook_server.js", // Absolute path to your webhook listener script
          cwd: "/home/ubuntu/webhook_listener/", // Working directory for the listener
          max_memory_restart: "100M",
          env: {
            NODE_ENV: "production",
          }
        }
      ]
    };
    ```
    **Customize this file:**
    *   `name`: The name for PM2.
    *   `script`: Path to the script to run.
    *   `args`: Arguments to pass to the script (CRITICAL for `zenbot.sh`). **Replace `"trade --paper"` with your actual Zenbot command arguments.**
    *   `cwd`: The current working directory for the script. For Zenbot, this should be its root directory (`/opt/zenbot`). For the webhook listener, it should be its directory (e.g., `/home/ubuntu/webhook_listener/`).
    *   `interpreter`: `bash` for `zenbot.sh`.
    *   `max_memory_restart`: Optional, useful for preventing memory leaks from crashing the server.
    *   `env`: Environment variables.
    *   **Adjust paths** for `script` and `cwd` for `zenbot_webhook_listener` to match where you placed it.

3.  **Start applications using the ecosystem file:**
    If your processes are already running, delete them from PM2 first:
    ```bash
    pm2 delete zenbot_trader
    pm2 delete zenbot_webhook_listener
    ```
    Then, from the directory containing `ecosystem.config.js` (e.g., `/opt/zenbot`):
    ```bash
    pm2 start ecosystem.config.js
    ```
    PM2 will start all applications defined in the file.

4.  **Modify your `deploy.sh` script to use the ecosystem file:**
    If you use an ecosystem file, your `deploy.sh` script can be simplified. Instead of complex `pm2 start` or `pm2 restart` commands with many arguments, you can just use:
    ```bash
    # In deploy.sh, after npm ci/install
    log "Restarting Zenbot and webhook listener via PM2 ecosystem file..."
    # Ensure PM2 is installed (check from earlier in deploy.sh)
    # cd /opt/zenbot # Ensure we are in the directory with ecosystem.config.js
    pm2 reload ecosystem.config.js --env production || pm2 startOrRestart ecosystem.config.js --env production || {
        log "Critical Error: Failed to reload/restart Zenbot via ecosystem file."
        exit 1
    }
    log "Applications reloaded/restarted via PM2 ecosystem file."
    ```
    `pm2 reload` provides a zero-downtime reload for Node.js applications that support it. `startOrRestart` is a robust alternative. You might need to adjust the command based on your PM2 version and needs. Often, `pm2 restart zenbot_trader` (if the ecosystem file only defines `zenbot_trader` and you manage the listener separately) or `pm2 restart ecosystem.config.js --only zenbot_trader` is sufficient if the ecosystem file is primarily for defining the Zenbot process.

    If the ecosystem file is in `/opt/zenbot/`, the `deploy.sh` script would already be in the correct directory. The `pm2 restart zenbot_trader` command in the existing `deploy.sh` would still work if the `zenbot_trader` process was initially started with the correct parameters (either manually or via an ecosystem file the first time).

    Using an ecosystem file is generally cleaner for managing PM2 configurations.

### 7.3 Persisting PM2 Processes

As mentioned in the testing phase, ensure PM2 is set up to revive your processes after a server reboot:
```bash
pm2 startup # Follow instructions to run the outputted command
pm2 save    # Saves the current list of processes managed by PM2
```
This is crucial for both `zenbot_trader` and `zenbot_webhook_listener` to ensure your trading bot and deployment mechanism come back online automatically.

By effectively using PM2, you can ensure your Zenbot application and its webhook listener are robustly managed, logged, and kept running on your Digital Ocean droplet.

## Conclusion and Further Steps

Congratulations! You have now set up a complete automated deployment pipeline from your local machine to your Digital Ocean droplet via GitHub. When you push changes to your `master` branch on GitHub, your Zenbot application on the droplet should automatically update and restart.

**Summary of what we accomplished:**

1.  **Installed Prerequisites:** Set up Node.js, NVM, MongoDB, and Git on your Ubuntu 22.04 droplet.
2.  **Secure SSH Access:** Configured SSH keys for secure communication between your droplet and GitHub, using a deploy key for read-only access to your repository.
3.  **Cloned Repository:** Successfully cloned your Zenbot application to the droplet.
4.  **Configured Zenbot:** Created `conf.js` from the sample, input your sensitive API keys (ensuring this file is gitignored), and installed Node.js dependencies.
5.  **GitHub Webhook:** Set up a webhook in your GitHub repository to notify your droplet of pushes to the `master` branch.
6.  **Webhook Listener:** Created a Node.js Express server (`webhook_server.js`) on your droplet to listen for and validate these webhook notifications securely using a shared secret.
7.  **Deployment Script:** Wrote a shell script (`deploy.sh`) that is triggered by the listener to pull the latest code, install dependencies, and restart Zenbot using PM2.
8.  **Process Management:** Used PM2 to run both the webhook listener and the Zenbot application persistently, with logging and auto-restart capabilities.
9.  **Tested the Pipeline:** Verified that the entire process works by pushing a test change.

**Important Security Reminders:**

*   **API Keys (`conf.js`):** This file contains extremely sensitive information. Ensure its permissions are `600` (readable/writable only by its owner) and that it is definitively in your `.gitignore` and never committed to any repository. Regularly review this.
*   **Webhook Secret:** Your `WEBHOOK_SECRET` should be strong and unique. If it leaks, an attacker could potentially trigger your deployment script.
*   **SSH Keys:** Protect your private SSH key on the droplet. Ensure its permissions are `600`.
*   **Droplet Security:** Keep your Digital Ocean droplet updated (`sudo apt update && sudo apt upgrade -y`). Use a firewall (UFW) and only open necessary ports. Consider tools like Fail2ban to protect against brute-force SSH attacks.
*   **HTTPS for Webhook:** For production, the webhook listener should be served over HTTPS to encrypt the payload from GitHub. This typically involves setting up a reverse proxy like Nginx or Caddy with a free SSL certificate from Let\s Encrypt.
*   **Principle of Least Privilege:** The user running the webhook listener and deployment script should only have the permissions necessary to perform its tasks.

**Further Steps and Enhancements:**

*   **HTTPS for Webhook Listener:** Implement HTTPS for your webhook endpoint as a priority for production.
*   **Advanced Logging & Monitoring:** Set up more robust logging (e.g., sending logs to a centralized logging service) and monitoring/alerting for your Zenbot application and the droplet itself.
*   **Database Backups:** Regularly back up your MongoDB database, especially if it stores important trading history or configuration.
*   **Staging Environment:** Before deploying to a live trading environment, consider setting up a separate staging droplet and repository branch to test changes thoroughly.
*   **More Robust Deployment Script:** Add more error handling, rollback capabilities, or notification mechanisms (e.g., email/Slack notifications on deployment success/failure) to `deploy.sh`.
*   **Zenbot Strategy and Configuration:** Deep dive into Zenbot\s documentation to understand and optimize its trading strategies and parameters for your chosen markets. Paper trade extensively before going live.
*   **Security Audits:** Regularly review your security configurations.

This automated setup should significantly streamline your development and deployment workflow for Zenbot. Remember that trading bots carry inherent risks, so always proceed with caution, especially when dealing with real funds.

