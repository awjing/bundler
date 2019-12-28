const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

// 分析入口文件
const moduleAnalyser = (filename) => {
  // 读出文件内容 - 转化成对象（抽象语法树ast）
  const content = fs.readFileSync(filename, 'utf-8')
  const ast = parser.parse(content, {
    sourceType: 'module'
  })

  // 找到import语句，分析依赖内容，依赖封装成对象（dependencies）
  // dependencies存储文件所有依赖关系，键值对形式，键 - 依赖文件的相对路径，值 - 依赖文件的绝对路径
  const dependencies = {}
  traverse(ast, {
    ImportDeclaration ({ node }) {
      const dirname = path.dirname(filename)
      const newFile = './' + path.join(dirname, node.source.value)
      dependencies[node.source.value] = newFile
    }
  })

  // 对代码进行编译，es6 -> 浏览器可识别
  const {code}  = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  })

  // 返回入口文件名字、依赖关系、被编译过后的代码
  return {
    filename,
    dependencies,
    code
  }
}

// 依赖图谱
const makeDependenciesGraph = (entry) => {
  // 所有模块通过moduleAnalyser进行分析，存储数组（graphArray）
  const entryModule = moduleAnalyser(entry)
  const graphArray = [entryModule]
  for (let i = 0; i < graphArray.length; i++) {
    const item = graphArray[i]
    const { dependencies } = item
    if (dependencies) {
      for (let j in dependencies) {
        graphArray.push(
          moduleAnalyser(dependencies[j])
        )
      }
    }
  }
  // 将数组进行处理，转换成对象进行return
  const graph = {}
  graphArray.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })
  return graph
}

const generateCode = (entry) => {
  const graph = JSON.stringify(makeDependenciesGraph(entry))

  return `
    (function(graph){
      function require(module) {
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath])
        }
        var exports = {};
        (function(require, exports, code){
          eval(code)
        })(localRequire, exports, graph[module].code)
        return exports
      };
      require('${entry}')
    })(${graph})
  `
}

const code = generateCode('./src/index.js')
console.log(code)

// node bundler.js | highlight
