import fs from 'fs';
import path from 'path';

describe('bump-version workflow PR flow', () => {
  it('uses the shared bump-version bash script', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github/workflows/bump-version.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain(
      './scripts/bump-version.sh "${{ inputs.bump }}"',
    );
  });

  it('runs bump script in no-tag mode for PR-based version bump', () => {
    const scriptPath = path.join(process.cwd(), 'scripts/bump-version.sh');
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain('skip_tag=false');
    expect(script).toContain('--no-tag');
    expect(script).toContain('npm version "${next_version}" --no-git-tag-version');
  });

  it('creates a pull request instead of pushing commit and tags directly', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github/workflows/bump-version.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('./scripts/bump-version.sh "${{ inputs.bump }}" --no-tag');
    expect(workflow).toContain('uses: peter-evans/create-pull-request@v7');
    expect(workflow).not.toContain('--follow-tags');
  });

  it('reads bumped version via two-step bash-safe output assignment', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github/workflows/bump-version.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain(
      'next_version="$(node -p "require(\'./package.json\').version")"',
    );
    expect(workflow).toContain('echo "next_version=${next_version}" >> "$GITHUB_OUTPUT"');
    expect(workflow).not.toContain(
      'echo "next_version=$(node -p \\"require(\'./package.json\').version\\")" >> "$GITHUB_OUTPUT"',
    );
  });
});
