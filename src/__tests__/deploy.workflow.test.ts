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
