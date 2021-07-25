# chia-manager

## Install node and deps

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
nvm install --lts
npm install -g yarn
```

## Run

```
git clone https://github.com/tobernguyen/chia-manager.git
cd chia-manager
yarn
node index.js
```

## Run application on startup automatically

```
yarn global add pm2
pm2 startup

cd ~/chia-manager
pm2 start index.js
pm2 save
```
