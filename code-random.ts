figma.showUI(__html__, { width: 400, height: 300 });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'apply-csv-scaling') {
    const values: number[] = msg.values;
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify("No elements selected.");
      return;
    }

    if (values.length !== selection.length) {
      figma.notify("Number of data values does not match number of selected elements.");
      return;
    }

    for (let i = 0; i < selection.length; i++) {
      const node = selection[i];
      const width = values[i];
      if ('resize' in node && typeof width === 'number' && width > 0) {
        node.resize(width, node.height);
      }
    }

    figma.notify("Widths updated from CSV data!");
  }
};
