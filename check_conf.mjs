// Check conf package config location
import('conf').then(({ default: Conf }) => {
  const c = new Conf({ projectName: 'autocliper' });
  console.log('Config path:', c.path);
  console.log('Has api.deepgram:', c.has('api.deepgram'));
  console.log('All keys:', Object.keys(c.store));
});
