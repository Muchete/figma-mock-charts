figma.showUI(__html__, { width: 400, height: 500 });

// This function maps a value from one range to another.
function map(value: number, currentLow: number, currentHigh: number, targetLow: number, targetHigh: number) {
    return targetLow + (targetHigh - targetLow) * (value - currentLow) / (currentHigh - currentLow);
}

figma.ui.onmessage = (msg) => {
  if (msg.type === 'apply-csv-scaling') {
    const values: number[] = msg.values;
    const inputMin = msg.range.inputMin ? msg.range.inputMin : Math.min(...values); // Use the provided inputMin or calculate the minimum from the values
    const inputMax = msg.range.inputMax ? msg.range.inputMax : Math.max(...values); // Use the provided inputMax or calculate the maximum from the values
    const min: number = msg.range.min;
    const max: number = msg.range.max; 
    const selection = figma.currentPage.selection;
    let mappedValues: number[] = [];

    console.log("Input Range:", inputMin, inputMax);

    if (values.length === 0) { // If no values are provided, generate random values
      for (let i = 0; i < selection.length; i++) {
        mappedValues.push(Math.round(map(Math.random(), 0, 1, min, max)));
      }
    } else { 
      mappedValues = values.map(value => 
        Math.round(map(value, inputMin, inputMax, min, max))
      )
    }
        
    console.log("Original Values:", values);
    console.log("Mapped Values:", mappedValues);

    if (selection.length === 0) {
      figma.notify("No elements selected.");
      return;
    } else if (selection.length > mappedValues.length) {
      figma.notify("More elements selected than values provided. Will repeat values.");
    } else if (selection.length < mappedValues.length) {
      
      figma.notify("Provided values exceed selected elements.");
    }

    for (let i = 0; i < selection.length; i++) {
      const node = selection[i];
      const valueIndex = i % mappedValues.length;
      let width = mappedValues[valueIndex];

      width = width === 0 ? 0.01 : width; //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      

      if ('resize' in node && typeof width === 'number' && width > 0) {
        node.resize(width, node.height);
      }
    }

    figma.notify("Widths updated!");
  }
};
