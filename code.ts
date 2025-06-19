const debugMode: boolean = true // Set to true to enable debug mode

async function getColorFromVariable(variableName: string): Promise<RGB | null> { // Fetches the color value from a Figma variable by its name
  // Step 1: Get all color variables


  const colorVariables = await figma.variables.getLocalVariablesAsync("COLOR")
  const variable = colorVariables.find(v => v.name === variableName)

  if (!variable) {
    console.warn(`Variable "${variableName}" not found.`)
    return null
  }

  // Step 2: Get the variable's collection and default mode
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const collection = collections.find(c => c.id === variable.variableCollectionId)

  if (!collection) {
    console.warn("Variable collection not found.")
    return null
  }

  const modeId = collection.defaultModeId

  // Step 3: Get the color value for the default mode
  const value = variable.valuesByMode[modeId]

  if (value && typeof value === "object" && "r" in value) {
    return value as RGB
  }
  return null
}

async function mapColorValues(colorRange: string[]) { // Maps color names or hex codes to actual RGB colors
  let mappedColorRange: any = []

  // set colorRange to actual colors
  for (let i = 0; i < colorRange.length; i++) {
    let cName: any = colorRange[i]

    if (isHexColor(cName)) {
      mappedColorRange[i] = cName // If it's a hex color, use it directly
    } else {
      cName = await getColorFromVariable(cName) // Otherwise, get the color from the variable
      if (cName) {
        mappedColorRange[i] = cName as RGB
      } else {
        mappedColorRange[i] = "#FF00FF88" // Default color if variable not found
      }
    }
  }

  return mappedColorRange
}

function clone(val: any): any { // needed to clone objects, as figma colors can't be set directly
  return JSON.parse(JSON.stringify(val))
}

function isHexColor(str: string): boolean {// Check if a string is a valid hex color code
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(str.trim())
}

function map(value: number, currentLow: number, currentHigh: number, targetLow: number, targetHigh: number): number {// This function maps a value from one range to another.
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

figma.showUI(__html__, { width: 400, height: 500 })

figma.ui.onmessage = (msg) => {
  const values: number[] = msg.values
  const inputMin = msg.range.inputMin ? msg.range.inputMin : Math.min(...values) // Use the provided inputMin or calculate the minimum from the values
  const inputMax = msg.range.inputMax ? msg.range.inputMax : Math.max(...values) // Use the provided inputMax or calculate the maximum from the values
  let min: number = msg.range.min
  let max: number = msg.range.max
  const colorRange: [] = msg.range.colorRange
  const selection = figma.currentPage.selection
  const applyToWidth = msg.applyTo.width
  const applyToHeight = msg.applyTo.height
  const applyToX = msg.applyTo.x
  const applyToY = msg.applyTo.y
  const applyToFill = msg.applyTo.fill
  const applyToStroke = msg.applyTo.stroke
  let mappedValues: number[] = []

  if (msg.type === "set-color") {// Set min and max based on the color range
    if (colorRange.length === 0) {
      figma.notify("No colors provided.", { error: true })
      return
    }
    min = 0
    max = colorRange.length - 1
  } else if (msg.type === "set-scale") { // If the action is set-scale, use the scaleMin and scaleMax
    min = msg.range.scaleMin
    max = msg.range.scaleMax
  }

  if (debugMode) {
    console.log("Debug Mode: ON")
    console.log("Mode:", msg.type)
    console.log("Input Range:", inputMin, inputMax)
    console.log("Target Range:", min, max)
    console.log("Target ColorRange:", colorRange)
  }

  if (!values.length) { // If no values are provided, generate random values
    for (let i = 0; i < selection.length; i++) {
      mappedValues.push(map(Math.random(), 0, 1, min, max))
    }
  } else { // If values are provided, map them to the target range
    mappedValues = values.map(value =>
      map(value, inputMin, inputMax, min, max)
    )
  }

  if (debugMode) {
    console.log("Original Values:", values)
    console.log("Mapped Values:", mappedValues)
  }

  if (selection.length === 0) {
    figma.notify("No elements selected.")
    return
  } else if (selection.length > mappedValues.length) {
    figma.notify("More elements selected than values provided. Will repeat values.")
  } else if (selection.length < mappedValues.length) {
    figma.notify("Provided values exceed selected elements.")
  }

  switch (msg.type) {
    case "set-w-h":
      // Resize each selected node based on the mapped values
      for (let i = 0; i < selection.length; i++) {
        const node = selection[i]
        let value = Math.round(mappedValues[i % mappedValues.length])
        value = value === 0 ? 0.01 : value //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      
        const width = applyToWidth ? value : node.width
        const height = applyToHeight ? value : node.height

        if ('resize' in node && typeof value === 'number' && value > 0) {
          node.resize(width, height)
        }
      }
      figma.notify("w/h updated!")
      break

    case "set-x-y":
      // position each selected node based on the mapped values
      for (let i = 0; i < selection.length; i++) {
        const node = selection[i]
        let value = Math.round(mappedValues[i % mappedValues.length])
        const x = applyToX ? value : node.x
        const y = applyToY ? value : node.y

        node.x = x
        node.y = y
      }

      figma.notify("x/y updated!")
      break

    case "set-scale":
      for (let i = 0; i < selection.length; i++) {
        const node = selection[i]
        let scaleFactor = mappedValues[i % mappedValues.length]
        scaleFactor = scaleFactor <= 0 ? 0.01 : scaleFactor //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      
        let xOffset = (node.width * scaleFactor - node.width) / 2
        let yOffset = (node.height * scaleFactor - node.height) / 2

        if (
          node.type === "RECTANGLE" ||
          node.type === "ELLIPSE" ||
          node.type === "FRAME" ||
          node.type === "COMPONENT" ||
          node.type === "INSTANCE" ||
          node.type === "TEXT" ||
          node.type === "VECTOR" ||
          node.type === "GROUP" ||
          node.type === "STAR"
        ) {
          node.rescale(scaleFactor)
          node.x -= xOffset // Adjust x position to keep the center
          node.y -= yOffset // Adjust y position to keep the center
        } else {
          figma.notify(`Resize not supported on node type: ${node.type}`)
        }

      }

      figma.notify("Scaled Selection!")

      break
    case "set-color":
      mapColorValues(colorRange).then(mappedColorRange => {
        // color each selected node based on the mapped values
        for (let i = 0; i < selection.length; i++) {
          const node = selection[i]
          const color = mappedColorRange[Math.round(mappedValues[i % mappedValues.length])] // Get the color from the mapped color range

          if (applyToFill) {
            if ("fills" in node) {
              const fills = clone(node.fills)
              fills[0] = figma.util.solidPaint(color, fills[0])
              node.fills = fills
            } else {
              console.error("Selected element does not support setting fills")
            }
          }
          if (applyToStroke) {
            if ("strokes" in node) {
              const strokes = clone(node.strokes)
              strokes[0] = figma.util.solidPaint(color, strokes[0])
              node.strokes = strokes
            } else {
              console.error("Selected element does not support setting strokes")
            }
          }
        }

        figma.notify("Colors updated!")
      })

      break
    default:
      break
  }
}
