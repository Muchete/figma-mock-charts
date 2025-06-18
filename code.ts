figma.showUI(__html__, { width: 400, height: 500 })

// This function maps a value from one range to another.
function map(value: number, currentLow: number, currentHigh: number, targetLow: number, targetHigh: number): number {
  currentLow = parseFloat(currentLow.toString())
  currentHigh = parseFloat(currentHigh.toString())
  targetLow = parseFloat(targetLow.toString())
  targetHigh = parseFloat(targetHigh.toString())

  if (currentLow === currentHigh) {
    console.warn("Current range is zero, returning targetLow to avoid division by zero.")
    return targetLow // Avoid division by zero
  }
  if (targetLow === targetHigh) {
    console.warn("Target range is zero, returning targetLow to avoid division by zero.")
    return targetLow // Avoid division by zero
  }
  if (value < currentLow || value > currentHigh) {
    console.warn(`Value ${value} is out of bounds (${currentLow}, ${currentHigh}). Clamping to range.`)
    value = Math.max(currentLow, Math.min(value, currentHigh)) // Clamp value to the current range
  }
  return targetLow + ((targetHigh - targetLow) * (value - currentLow)) / (currentHigh - currentLow)
}

figma.ui.onmessage = (msg) => {
  const values: number[] = msg.values
  const inputMin = msg.range.inputMin ? msg.range.inputMin : Math.min(...values) // Use the provided inputMin or calculate the minimum from the values
  const inputMax = msg.range.inputMax ? msg.range.inputMax : Math.max(...values) // Use the provided inputMax or calculate the maximum from the values
  const min: number = msg.range.min
  const max: number = msg.range.max
  const selection = figma.currentPage.selection
  const applyToWidth = msg.applyTo.width
  const applyToHeight = msg.applyTo.height
  const applyToX = msg.applyTo.x
  const applyToY = msg.applyTo.y
  let mappedValues: number[] = []

  console.log(msg.applyTo)

  console.log("Input Range:", inputMin, inputMax)
  console.log("Target Range:", min, max)

  if (!values.length) { // If no values are provided, generate random values
    for (let i = 0; i < selection.length; i++) {
      mappedValues.push(Math.round(map(Math.random(), 0, 1, min, max)))
    }
  } else { // If values are provided, map them to the target range
    mappedValues = values.map(value =>
      Math.round(map(value, inputMin, inputMax, min, max))
    )
  }

  console.log("Original Values:", values)
  console.log("Mapped Values:", mappedValues)

  if (selection.length === 0) {
    figma.notify("No elements selected.")
    return
  } else if (selection.length > mappedValues.length) {
    figma.notify("More elements selected than values provided. Will repeat values.")
  } else if (selection.length < mappedValues.length) {
    figma.notify("Provided values exceed selected elements.")
  }

  switch (msg.type) {
    case "set-width-height":
      // Resize each selected node based on the mapped values
      for (let i = 0; i < selection.length; i++) {
        const node = selection[i]
        let value = mappedValues[i % mappedValues.length]
        value = value === 0 ? 0.01 : value //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      
        const width = applyToWidth ? value : node.width
        const height = applyToHeight ? value : node.height

        if ('resize' in node && typeof value === 'number' && value > 0) {
          node.resize(width, height)
        }
      }
      figma.notify("Widths updated!")
      break

    case "set-x-y":
      // position each selected node based on the mapped values
      for (let i = 0; i < selection.length; i++) {
        const node = selection[i]
        let value = mappedValues[i % mappedValues.length]
        // value = value === 0 ? 0.01 : value //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      
        const x = applyToX ? value : node.x
        const y = applyToY ? value : node.y

        if ('x' in node && typeof x === 'number') {
          node.x = x
        }
        if ('y' in node && typeof y === 'number') {
          node.y = y
        }
      }
      figma.notify("Widths updated!")

      break
    default:
      break
  }
}
