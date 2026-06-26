import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (
      error?.code !== 'ERR_MODULE_NOT_FOUND' ||
      (!specifier.startsWith('./') && !specifier.startsWith('../')) ||
      path.extname(specifier)
    ) {
      throw error;
    }

    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const resolvedPath = path.resolve(path.dirname(parentPath), `${specifier}.js`);
    await access(resolvedPath);
    return defaultResolve(pathToFileURL(resolvedPath).href, context, defaultResolve);
  }
}
