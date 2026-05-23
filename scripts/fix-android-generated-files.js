const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wrapperPath = path.join(rootDir, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
const gradlePropsPath = path.join(rootDir, 'android', 'gradle.properties');

const gradleDistributionUrl = 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.0.0-bin.zip';
const javaHomeLine = 'org.gradle.java.home=/home/tanay/opt/jdks/jdk17';

function updateFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  for (const { pattern, value } of replacements) {
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, value);
    } else {
      updated = `${updated.replace(/\s*$/, '')}\n${value}\n`;
    }
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
    return true;
  }

  return false;
}

const wrapperChanged = updateFile(wrapperPath, [
  {
    pattern: /^distributionUrl=.*$/m,
    value: gradleDistributionUrl,
  },
]);

const gradlePropsChanged = updateFile(gradlePropsPath, [
  {
    pattern: /^org\.gradle\.java\.home=.*$/m,
    value: javaHomeLine,
  },
]);

console.log(
  [
    wrapperChanged ? `updated ${path.relative(rootDir, wrapperPath)}` : `already set ${path.relative(rootDir, wrapperPath)}`,
    gradlePropsChanged ? `updated ${path.relative(rootDir, gradlePropsPath)}` : `already set ${path.relative(rootDir, gradlePropsPath)}`,
  ].join('\n'),
);
