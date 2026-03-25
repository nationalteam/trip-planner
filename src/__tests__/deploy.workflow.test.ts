import fs from 'fs';
import path from 'path';

describe('deploy workflow Google Maps env wiring', () => {
  it('sets GOOGLE_MAPS_API_KEY from secret into .env', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/deploy.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY }}');
    expect(workflow).toContain('echo "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}"');
  });
});

describe('bump version workflow', () => {
  it('supports manual patch/minor/major input and uses PAT token', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/bump-version.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('name: Bump Version');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('bump:');
    expect(workflow).toContain('default: "patch"');
    expect(workflow).toContain('type: choice');
    expect(workflow).toContain('- patch');
    expect(workflow).toContain('- minor');
    expect(workflow).toContain('- major');
    expect(workflow).toContain('github-token: ${{ secrets.PAT_TOKEN }}');
    expect(workflow).toContain("if (refType !== 'branch') {");
    expect(workflow).toContain('if [ "${GITHUB_REF_TYPE}" != "branch" ]; then');
    expect(workflow).toContain('PAT_TOKEN: ${{ secrets.PAT_TOKEN }}');
    expect(workflow).toContain('x-access-token:${PAT_TOKEN}@github.com/${GITHUB_REPOSITORY}.git');
  });
});
