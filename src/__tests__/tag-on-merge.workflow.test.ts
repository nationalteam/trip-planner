import fs from 'fs';
import path from 'path';

describe('tag-on-merge workflow', () => {
  it('runs only when a PR is merged into main', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github/workflows/tag-on-merge.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('types: [closed]');
    expect(workflow).toContain("github.event.pull_request.merged == true");
    expect(workflow).toContain("github.event.pull_request.base.ref == 'main'");
  });

  it('creates and pushes version tag from package.json when tag does not exist', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github/workflows/tag-on-merge.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('node -p "require(\'./package.json\').version"');
    expect(workflow).toContain('git rev-parse --verify --quiet "refs/tags/${TAG_NAME}"');
    expect(workflow).toContain('git tag -a "${TAG_NAME}" -m "chore(release): ${TAG_NAME}"');
    expect(workflow).toContain('git push origin "${TAG_NAME}"');
  });
});
