function headingBranches(levels: number[], idleLevels: number) {
  const cutoff = Math.min(6, ...levels) + idleLevels - 1;
  let root = 0;
  return levels.map((level, index) => {
    if (index === 0 || level <= cutoff) root = index;
    return root;
  });
}

function hierarchyVisible(
  levels: number[],
  idleLevels: number,
  current: number,
  expanded: number,
) {
  const branches = headingBranches(levels, idleLevels);
  // Retain the current heading even while its branch is folded.
  return branches.map(
    (root, index) => root === index || root === expanded || index === current,
  );
}

export { headingBranches, hierarchyVisible };
