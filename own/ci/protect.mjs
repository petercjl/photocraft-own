// Restore the complete owned namespace, including deletion of newly introduced upstream files.
export function restoreOwned(git,base) {
  git('show',`${base}:own/upstream.json`);
  git('restore','--source',base,'--staged','--worktree','--','own/',':(glob).github/workflows/own-*');
}
