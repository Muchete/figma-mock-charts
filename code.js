"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const debugMode = true; // Set to true to enable debug mode
function getColorFromVariable(variableName) {
    return __awaiter(this, void 0, void 0, function* () {
        // Step 1: Get all color variables
        const colorVariables = yield figma.variables.getLocalVariablesAsync("COLOR");
        const variable = colorVariables.find(v => v.name === variableName);
        if (!variable) {
            console.warn(`Variable "${variableName}" not found.`);
            return null;
        }
        // Step 2: Get the variable's collection and default mode
        const collections = yield figma.variables.getLocalVariableCollectionsAsync();
        const collection = collections.find(c => c.id === variable.variableCollectionId);
        if (!collection) {
            console.warn("Variable collection not found.");
            return null;
        }
        const modeId = collection.defaultModeId;
        // Step 3: Get the color value for the default mode
        const value = variable.valuesByMode[modeId];
        if (value && typeof value === "object" && "r" in value) {
            return value;
        }
        return null;
    });
}
function mapColorValues(colorRange) {
    return __awaiter(this, void 0, void 0, function* () {
        let mappedColorRange = [];
        // set colorRange to actual colors
        for (let i = 0; i < colorRange.length; i++) {
            let cName = colorRange[i];
            if (isHexColor(cName)) {
                mappedColorRange[i] = cName; // If it's a hex color, use it directly
            }
            else {
                cName = yield getColorFromVariable(cName); // Otherwise, get the color from the variable
                mappedColorRange[i] = cName ? cName : "#FF00FF88"; // Default color if variable not found
            }
        }
        return mappedColorRange;
    });
}
function clone(val) {
    return JSON.parse(JSON.stringify(val));
}
function isHexColor(str) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(str.trim());
}
function map(value, currentLow, currentHigh, targetLow, targetHigh) {
    currentLow = parseFloat(currentLow.toString());
    currentHigh = parseFloat(currentHigh.toString());
    targetLow = parseFloat(targetLow.toString());
    targetHigh = parseFloat(targetHigh.toString());
    if (currentLow === currentHigh) {
        console.warn("Current range is zero, returning targetLow to avoid division by zero.");
        return targetLow; // Avoid division by zero
    }
    if (targetLow === targetHigh) {
        console.warn("Target range is zero, returning targetLow to avoid division by zero.");
        return targetLow; // Avoid division by zero
    }
    if (value < currentLow || value > currentHigh) {
        console.warn(`Value ${value} is out of bounds (${currentLow}, ${currentHigh}). Clamping to range.`);
        value = Math.max(currentLow, Math.min(value, currentHigh)); // Clamp value to the current range
    }
    return targetLow + ((targetHigh - targetLow) * (value - currentLow)) / (currentHigh - currentLow);
}
function countPathPoints(d) {
    const commandRegex = /([MLZ])([^MLZ]*)/gi;
    let match;
    let pointCount = 0;
    while ((match = commandRegex.exec(d)) !== null) {
        const command = match[1].toUpperCase();
        const args = match[2].trim().split(/[\s,]+/).filter(n => n.length > 0);
        switch (command) {
            case "M":
                pointCount += 1; // Always 1 move point
                break;
            case "L":
                pointCount += Math.floor(args.length / 2); // Each (x, y) pair = 1 point
                break;
            case "Z":
                // No point added for Z
                break;
        }
    }
    return pointCount;
}
figma.showUI(__html__, { width: 400, height: 612 });
figma.ui.onmessage = (msg) => {
    const values = msg.values;
    const inputMin = msg.range.inputMin ? msg.range.inputMin : Math.min(...values); // Use the provided inputMin or calculate the minimum from the values
    const inputMax = msg.range.inputMax ? msg.range.inputMax : Math.max(...values); // Use the provided inputMax or calculate the maximum from the values
    let min = msg.range.min;
    let max = msg.range.max;
    const colorRange = msg.range.colorRange;
    const selection = figma.currentPage.selection;
    const applyToWidth = msg.applyTo.width;
    const applyToHeight = msg.applyTo.height;
    const applyToX = msg.applyTo.x;
    const applyToY = msg.applyTo.y;
    const applyToFill = msg.applyTo.fill;
    const applyToStroke = msg.applyTo.stroke;
    const applyToOpacity = msg.applyTo.opacity;
    let mappedValues = [];
    let pointCount = 0;
    if (selection.length === 0) {
        figma.notify("No elements selected.");
        return;
    }
    if (msg.type === "set-color") { // Set min and max based on the color range
        if (colorRange.length === 0) {
            figma.notify("No colors provided.", { error: true });
            return;
        }
        min = 0;
        max = colorRange.length - 1;
    }
    else if (msg.type === "set-opacity") { // If the action is set-opacity, use the min and max from the range
        if (!min || min < 0)
            min = 0; // Ensure min is at least 0 and not undefined
        if (!max || max > 100)
            max = 100; //Ensure max is at most 100 and not undefined
    }
    else if (msg.type === "set-scale") { // If the action is set-scale, use the scaleMin and scaleMax
        min = msg.range.scaleMin;
        max = msg.range.scaleMax;
    }
    else if (msg.type === "set-x-y-vector") { // If the action is set-x-y-vector, use the vectorMin and vectorMax
        if (selection[0].type === "VECTOR") {
            if (values.length > 0) {
                pointCount = values.length; // If values are provided, use the length of the values array
            }
            else {
                pointCount = countPathPoints(selection[0].vectorPaths[0].data);
            }
        }
        else {
            figma.notify("Selected element is not a vector. Please select a vector element to set points.", { error: true });
            return;
        }
    }
    if (debugMode) {
        console.log("Mode:", msg.type);
        console.log("Input Range:", inputMin, inputMax);
        console.log("Target Range:", min, max);
        console.log("Target ColorRange:", colorRange);
        console.log("Point Count:", pointCount);
    }
    if (!values.length) { // If no values are provided, generate random values
        for (let i = 0; i < selection.length; i++) {
            if (msg.type !== "set-x-y-vector") {
                mappedValues.push(map(Math.random(), 0, 1, min, max));
            }
            else { // If the action is set-x-y-vector, generate Xpoints for each vector
                for (let j = 0; j < pointCount; j++) {
                    mappedValues.push(map(Math.random(), 0, 1, min, max));
                }
            }
        }
    }
    else { // If values are provided, map them to the target range
        mappedValues = values.map(value => map(value, inputMin, inputMax, min, max));
    }
    if (selection.length > mappedValues.length) {
        figma.notify("More elements selected than values provided. Will repeat values.");
    }
    else if (selection.length < mappedValues.length) {
        if (msg.type !== "set-x-y-vector") {
            figma.notify("Provided values exceed selected elements.");
        }
    }
    if (debugMode) {
        console.log("Original Values:", values);
        console.log("Mapped Values:", mappedValues);
    }
    switch (msg.type) {
        case "set-w-h":
            // Resize each selected node based on the mapped values
            for (let i = 0; i < selection.length; i++) {
                const node = selection[i];
                let value = Math.round(mappedValues[i % mappedValues.length]);
                let yBottom = node.y + node.height; // Store the original bottom position to keep it unchanged
                value = value === 0 ? 0.01 : value; //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      
                const width = applyToWidth ? value : node.width;
                const height = applyToHeight ? value : node.height;
                if ('resize' in node && typeof value === 'number' && value > 0) {
                    node.resize(width, height);
                    if (applyToHeight) {
                        node.y = yBottom - height; // Adjust y position to keep the bottom position unchanged
                    }
                }
            }
            figma.notify("w/h updated!");
            break;
        case "set-x-y":
            // position each selected node based on the mapped values
            for (let i = 0; i < selection.length; i++) {
                const node = selection[i];
                let value = Math.round(mappedValues[i % mappedValues.length]);
                const x = applyToX ? value : node.x;
                const y = applyToY ? map(value, min, max, max, min) : node.y; //invert the value for y-axis
                node.x = x;
                node.y = y;
            }
            figma.notify("x/y updated!");
            break;
        case "set-x-y-vector":
            // position each selected node based on the mapped values
            for (let i = 0; i < selection.length; i++) {
                const node = selection[i];
                let xOriginal = node.x; //store the original x position to set the x position of the vector points
                let yOriginal = node.y; //store the original y position to set the y position of the vector points
                if (node.type === "VECTOR") {
                    let d = ""; // Initialize the path data string;
                    let xStep = node.width / (pointCount - 1);
                    let yStep = node.height / (pointCount - 1);
                    for (let j = 0; j < pointCount; j++) {
                        let x = j * xStep;
                        let y = j * yStep;
                        let pointId = (i * pointCount + j);
                        let value = mappedValues[pointId % mappedValues.length];
                        x = applyToX ? (value - xOriginal) : x; // If applyToX is true, use the mapped value for x
                        y = applyToY ? map(value, min, max, max, min) - yOriginal : y; // If applyToY is true, use the mapped value for y (inverted for y-axis)
                        if (j === 0) {
                            d = `M ${x} ${y}`; // Move to the first point
                        }
                        else {
                            d += ` L ${x} ${y}`; // Line to the next point
                        }
                    }
                    if (debugMode)
                        console.log(d);
                    node.vectorPaths = [
                        {
                            windingRule: "NONZERO",
                            data: d // Set the path data to the constructed string
                        }
                    ];
                }
            }
            figma.notify("Vector updated!");
            break;
        case "set-scale":
            for (let i = 0; i < selection.length; i++) {
                const node = selection[i];
                let scaleFactor = mappedValues[i % mappedValues.length];
                scaleFactor = scaleFactor <= 0 ? 0.01 : scaleFactor; //set a minimum width to avoid zero-width elements as this can't be handled by Figma node.resize      
                let xOffset = (node.width * scaleFactor - node.width) / 2;
                let yOffset = (node.height * scaleFactor - node.height) / 2;
                if (node.type === "RECTANGLE" ||
                    node.type === "ELLIPSE" ||
                    node.type === "FRAME" ||
                    node.type === "COMPONENT" ||
                    node.type === "INSTANCE" ||
                    node.type === "TEXT" ||
                    node.type === "VECTOR" ||
                    node.type === "GROUP" ||
                    node.type === "STAR") {
                    node.rescale(scaleFactor);
                    node.x -= xOffset; // Adjust x position to keep the center
                    node.y -= yOffset; // Adjust y position to keep the center
                }
                else {
                    figma.notify(`Resize not supported on node type: ${node.type}`);
                }
            }
            figma.notify("Scaled Selection!");
            break;
        case "set-color":
            mapColorValues(colorRange).then(mappedColorRange => {
                // color each selected node based on the mapped values
                for (let i = 0; i < selection.length; i++) {
                    const node = selection[i];
                    const color = mappedColorRange[Math.round(mappedValues[i % mappedValues.length])]; // Get the color from the mapped color range
                    if (applyToFill) {
                        if ("fills" in node) {
                            const fills = clone(node.fills);
                            fills[0] = figma.util.solidPaint(color, fills[0]);
                            node.fills = fills;
                        }
                        else {
                            console.error("Selected element does not support setting fills");
                        }
                    }
                    if (applyToStroke) {
                        if ("strokes" in node) {
                            const strokes = clone(node.strokes);
                            strokes[0] = figma.util.solidPaint(color, strokes[0]);
                            node.strokes = strokes;
                        }
                        else {
                            console.error("Selected element does not support setting strokes");
                        }
                    }
                }
                figma.notify("Colors updated!");
            });
            break;
        case "set-opacity":
            for (let i = 0; i < selection.length; i++) {
                const node = selection[i];
                const value = Math.round(mappedValues[i % mappedValues.length]) / 100; // Convert to a percentage for opacity
                if (node.type === "BOOLEAN_OPERATION" ||
                    node.type === "COMPONENT" ||
                    node.type === "CONNECTOR" ||
                    node.type === "ELLIPSE" ||
                    node.type === "FRAME" ||
                    node.type === "GROUP" ||
                    node.type === "HIGHLIGHT" ||
                    node.type === "INSTANCE" ||
                    node.type === "LINE" ||
                    node.type === "POLYGON" ||
                    node.type === "RECTANGLE" ||
                    node.type === "SHAPE_WITH_TEXT" ||
                    node.type === "STAR" ||
                    node.type === "TEXT" ||
                    node.type === "TEXT_PATH" ||
                    node.type === "TRANSFORM_GROUP" ||
                    node.type === "VECTOR") {
                    node.opacity = value; // Set the opacity directly for rectangles
                }
                else {
                    figma.notify(`Resize not supported on node type: ${node.type}`, { error: true });
                }
            }
            figma.notify("Opacity updated!");
            break;
        default:
            break;
    }
};
