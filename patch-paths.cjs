const fs = require('fs');
const glob = require('glob');

// Function to update require statements in a file
const updateRequireStatements = filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const updatedContent = content.replace(
    /require\((['"]\.\/[^'"]+)\.js(['"])\)/g,
    'require($1.cjs$2)',
  );
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`Updated require statements in ${filePath}`);
};

// Find all .cjs files in the dist directory
const cjsFiles = glob.sync('dist/**/*.cjs');

// Update each .cjs file
cjsFiles.forEach(updateRequireStatements);

console.log('Post-build script completed.');
