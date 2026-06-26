import { projectionTestManifest } from '../test/projection-manifest.mjs';

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

console.log('Projection Test Manifest Summary');
console.log(`Total cases: ${projectionTestManifest.length}`);
console.log('');

console.log('By view:');
for (const [key, count] of countBy(projectionTestManifest, (item) => item.view)) {
  console.log(`- ${key}: ${count}`);
}
console.log('');

console.log('By assertion strategy:');
for (const [key, count] of countBy(projectionTestManifest, (item) => item.strategy)) {
  console.log(`- ${key}: ${count}`);
}
console.log('');

console.log('By semantic category:');
for (const [key, count] of countBy(projectionTestManifest, (item) => `${item.family} / ${item.category}`)) {
  console.log(`- ${key}: ${count}`);
}
console.log('');

console.log('Dependency profile:');
for (const item of projectionTestManifest) {
  const deps = Array.isArray(item.dependencies) && item.dependencies.length > 0 ? item.dependencies.join(', ') : '(none)';
  console.log(`- ${item.id}: ${deps}`);
}
