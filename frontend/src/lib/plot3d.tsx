import createPlotlyComponent from 'react-plotly.js/factory'
// Partial gl3d-only bundle (scatter3d/mesh3d/surface) - avoids pulling in plotly.js's
// full trace set (choropleth/mapbox, which drags in maplibre-gl) since this app only ever
// renders schematic 3D reconstructions, never geographic map traces.
import Plotly from 'plotly.js-gl3d-dist-min'

export const Plot = createPlotlyComponent(Plotly as unknown as object)
