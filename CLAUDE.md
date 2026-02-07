# Purpose of the mermaid-to-tldraw repo

The goal of this project is to experiment with how we can best render Mermaid diagrams to look like Tldraw's built-in shapes. It's inspired by a new project from Craft Docs called beautiful-mermaid (http://npmjs.org/beautiful-mermaid and https://github.com/lukilabs/beautiful-mermaid). We aren't using it's code as of now though.

# Project folder layout

Project is a pnpm monorepo.

Top-level folders:
apps (all top-level app likes should go here: clis, web-uis, react-native mobile apps, etc)
demo (vite app that houses a simple Tldraw SDK app and consumes the mermaid-to-tldraw package to act as a test bed for our work)

- packages
  - mermaid-to-tldraw (where code for converting from mermaid to tldraw shapes lives. See the autoConvertToTldraw function in particular)

There's two general directions we're experimenting with.

First:
We generate diagrams using the 'mermaid' package and then customize them using mermaid's package's themeVariables, and then via some post processing for things we can't quite do using it like doing custom arrow heads. We made a Tldraw shape for it, see apps/src/demo/MermaidShape.tsx, so we can drop mermaid diagrams onto whiteboards and move them around as one singular object.

Second:
We are try to recreate the mermaid diagrams as the built in Tldraw shapes, so that we can directly manipulate and edit them after in a more flexible, albeit less structured way. This is implemented more in the packages/mermaid-to-tldraw package.
