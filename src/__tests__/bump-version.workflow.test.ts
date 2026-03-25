import fs from 'fs';
import path from 'path';

describe('bump-version workflow tag conflict handling', () => {
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

  it('handles existing tags by bumping until an available version is found', () => {
    const scriptPath = path.join(process.cwd(), 'scripts/bump-version.sh');
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain(
      'while git rev-parse --verify --quiet "refs/tags/v${next_version}"',
    );
    expect(script).toContain(
      'Tag v${next_version} already exists; bumping ${bump_type} again.',
    );
  });
});
