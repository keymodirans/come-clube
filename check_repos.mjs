// Check GitHub repositories
const response = await fetch('https://api.github.com/users/keymodirans/repos?per_page=100', {
  headers: {
    'Authorization': 'Bearer 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',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

const repos = await response.json();

console.log('=== Repositories milik keymodirans ===\n');

repos.forEach(repo => {
  console.log(`- ${repo.name} (${repo.private ? 'private' : 'public'})`);
  if (repo.description) {
    console.log(`  ${repo.description}`);
  }
  console.log(`  Updated: ${repo.updated_at}`);
  console.log('');
});

// Cari repo yang mungkin untuk autocliper renderer
const rendererRepos = repos.filter(r =>
  r.name.includes('autocliper') ||
  r.name.includes('render') ||
  r.name.includes('cliper')
);

if (rendererRepos.length > 0) {
  console.log('=== Repo yang mungkin untuk AutoCliper renderer ===');
  rendererRepos.forEach(r => {
    console.log(`- ${r.name}`);
    console.log(`  ${r.description || 'No description'}`);
  });
} else {
  console.log('x Tidak ditemukan repo autocliper-renderer');
  console.log('\nPerlu membuat repo baru untuk workflow GitHub Actions rendering.');
}
