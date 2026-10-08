import { ShapeModel } from './model.js'
import { layout } from './layout.js'
let model
async function load() {
  const responses = await Promise.all([fetch('/handwriting-model/model.json'), fetch('/handwriting-model/weights.bin')])
  if (responses.some(r => !r.ok)) throw Error('Could not load the handwriting model. Please retry.')
  return new ShapeModel(await responses[0].json(), await responses[1].arrayBuffer())
}
self.onmessage = async ({ data }) => {
  try {
    model ||= load().catch(error => { model = null; throw error })
    const ready = await model
    self.postMessage({ id: data.id, document: layout(ready, data.text, data.options) })
  } catch (error) { self.postMessage({ id: data.id, error: error.message }) }
}
