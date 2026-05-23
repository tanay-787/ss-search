const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'vendor', 'react-native-siglip', 'dist', 'android');
const sourceBuildDir = path.join(rootDir, 'vendor', 'react-native-siglip', '.executorch-build', 'executorch');
const packageDir = path.join(rootDir, 'node_modules', 'react-native-siglip');
const targetDir = path.join(packageDir, 'dist', 'android');
const targetBuildDir = path.join(packageDir, '.executorch-build', 'executorch');

if (!fs.existsSync(sourceDir)) {
  throw new Error(
    `Missing SigLIP binaries at ${sourceDir}. Expected vendor/react-native-siglip/dist/android to be checked in.`,
  );
}

if (!fs.existsSync(sourceBuildDir)) {
  throw new Error(
    `Missing ExecuTorch build tree at ${sourceBuildDir}. Expected vendor/react-native-siglip/.executorch-build/executorch to be checked in.`,
  );
}

if (!fs.existsSync(packageDir)) {
  throw new Error(
    'react-native-siglip is not installed yet. Run package installation before copying binaries.',
  );
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.rmSync(targetBuildDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.mkdirSync(path.dirname(targetBuildDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
fs.cpSync(sourceBuildDir, targetBuildDir, { recursive: true });
