export const buildTree = (employees: any[]) => {
  const map: Record<string, any> = {};
  const roots: any[] = [];

  employees.forEach((e) => {
    map[e.id] = { ...e, children: [] };
  });

  employees.forEach((e) => {
    if (e.manager_id && map[e.manager_id]) {
      map[e.manager_id].children.push(map[e.id]);
    } else {
      roots.push(map[e.id]);
    }
  });

  return roots;
};

