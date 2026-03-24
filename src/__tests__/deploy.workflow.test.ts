import fs from 'fs';
import path from 'path';

describe('deploy workflow Google Maps env wiring', () => {
  it('sets Google Maps API keys with bidirectional secret fallbacks', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/deploy.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain(
      'GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY || secrets.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }}',
    );
    expect(workflow).toContain(
      'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${{ secrets.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || secrets.GOOGLE_MAPS_API_KEY }}',
    );
    expect(workflow).toContain('echo "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}"');
    expect(workflow).toContain(
      'echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}"',
    );
  });
});
