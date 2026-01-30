const response = await fetch('https://api.github.com/repos/keymodirans/renderer-clips/actions/workflows', {
  headers: {
    'Authorization': 'Bearer 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',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

const data = await response.json();

console.log('=== GitHub Actions Workflows di renderer-clips ===\n');

if (data.total_count === 0) {
  console.log('x Tidak ada workflow sama sekali');
  console.log('\nPerlu setup workflow.yml untuk rendering Remotion.');
  console.log('\nWorkflow yang dibutuhkan:');
  console.log('1. Terima repository_dispatch event');
  console.log('2. Download video dari URL');
  console.log('3. Render pakai Remotion (npx remotion render)');
  console.log('4. Upload artifact');
} else {
  data.workflows.forEach(w => {
    console.log(`- ${w.name} (${w.state})`);
    console.log(`  Path: ${w.path}`);
    console.log(`  URL: ${w.html_url}`);
    console.log('');
  });
}
