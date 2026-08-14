import fs from "node:fs";
import ts from "../web/node_modules/typescript/lib/typescript.js";

const [sourcePath, functionName, stem] = process.argv.slice(2);
if (!sourcePath || !functionName || !stem) throw new Error("usage: source function stem");

const text = fs.readFileSync(sourcePath, "utf8");
const source = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === functionName,
);
if (!fn?.body) throw new Error(`function ${functionName} not found`);
const returned = fn.body.statements.find(ts.isReturnStatement);
if (!returned?.expression) throw new Error("return statement not found");

const names = [];
function collectBinding(name) {
  if (ts.isIdentifier(name)) names.push(name.text);
  else for (const element of name.elements) if (ts.isBindingElement(element)) collectBinding(element.name);
}
for (const statement of fn.body.statements) {
  if (statement === returned) break;
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) collectBinding(declaration.name);
  } else if (ts.isFunctionDeclaration(statement) && statement.name) {
    names.push(statement.name.text);
  }
}

const imports = text.slice(0, fn.getFullStart());
const beforeReturn = text.slice(fn.body.getStart(source) + 1, returned.getFullStart());
const expression = returned.expression.getText(source);
const directory = sourcePath.slice(0, sourcePath.lastIndexOf("/"));
const controllerName = `create${stem}Controller`;

fs.writeFileSync(
  `${directory}/${stem}Controller.tsx`,
  `${imports}export function ${controllerName}() {${beforeReturn}\n  return {\n    ${names.join(",\n    ")},\n  };\n}\n\nexport type ${stem}Controller = ReturnType<typeof ${controllerName}>;\n`,
);
fs.writeFileSync(
  `${directory}/${stem}Context.tsx`,
  `import { createContext, useContext, type ParentProps } from "solid-js";\nimport type { ${stem}Controller } from "./${stem}Controller";\n\nconst ${stem}Context = createContext<${stem}Controller>();\n\nexport function ${stem}Provider(props: ParentProps<{ value: ${stem}Controller }>) {\n  return <${stem}Context value={props.value}>{props.children}</${stem}Context>;\n}\n\nexport function use${stem}() {\n  return useContext(${stem}Context);\n}\n`,
);
fs.writeFileSync(
  `${directory}/${stem}View.tsx`,
  `${imports}import { use${stem} } from "./${stem}Context";\n\nexport default function ${stem}View() {\n  const {\n    ${names.join(",\n    ")},\n  } = use${stem}();\n  return ${expression};\n}\n`,
);
fs.writeFileSync(
  sourcePath,
  `import { ${stem}Provider } from "./${stem}Context";\nimport { ${controllerName} } from "./${stem}Controller";\nimport ${stem}View from "./${stem}View";\n\nexport default function ${functionName}() {\n  const controller = ${controllerName}();\n  return (\n    <${stem}Provider value={controller}>\n      <${stem}View />\n    </${stem}Provider>\n  );\n}\n`,
);
