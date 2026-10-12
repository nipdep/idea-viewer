import React from 'react';
import { EdgeSymbol, MarkSymbol, NodeSymbol } from './symbols';
import { docsUrl } from './docs-url';

// The legend lists only what is needed to read a graph at a glance. Every row links to its section of the
// documentation page, which holds the complete notation (patterns, edge cases, the OWL / RDF differences).
const OWL_SECTIONS = [
  {
    title: 'Nodes',
    rows: [
      { symbol: <NodeSymbol kind="class" />, text: 'Class', anchor: 'classes' },
      { symbol: <NodeSymbol kind="individual" />, text: 'Named individual', anchor: 'individuals' },
      { symbol: <NodeSymbol kind="datatype" />, text: 'Datatype', anchor: 'datatypes' },
      { symbol: <NodeSymbol kind="literal" />, text: 'Literal value', anchor: 'literals' },
      { symbol: <NodeSymbol kind="connector" label="∩" />, text: 'Class expression: ∩ ∪ ¬', anchor: 'class-expressions' },
      { symbol: <NodeSymbol kind="enumeration" />, text: 'Dashed area: owl:oneOf members', anchor: 'enumerations' },
    ],
  },
  {
    title: 'Edges',
    rows: [
      { symbol: <EdgeSymbol tone="property" />, text: 'Object property', anchor: 'properties' },
      { symbol: <EdgeSymbol tone="property" line="dashed" />, text: 'Data property (to a datatype or literal)', anchor: 'properties' },
      { symbol: <EdgeSymbol arrow="hollow" />, text: 'subClassOf', anchor: 'class-axioms' },
      { symbol: <EdgeSymbol />, text: 'Built-in rdf / rdfs / owl relation (grey)', anchor: 'colors' },
      { symbol: <EdgeSymbol line="dotted" />, text: 'Added connector or membership edge', anchor: 'line-styles' },
    ],
  },
  {
    title: 'Marks on labels',
    marks: [
      { mark: '(some) (all)', text: 'quantified restriction', anchor: 'restrictions' },
      { mark: '* **', text: 'restriction from subClassOf / equivalentClass', anchor: 'restrictions' },
      { mark: '0..* 1', text: 'cardinality, on the class side', anchor: 'cardinality' },
      { mark: '≡ ≢', text: 'equivalent / disjoint', anchor: 'class-axioms' },
      { mark: '[F] [T] [S]', text: 'property characteristics', anchor: 'property-characteristics' },
      { mark: '⛓', text: 'property chain (see side panel)', anchor: 'property-chains' },
    ],
  },
];

const RDF_SECTIONS = [
  {
    title: 'Nodes',
    rows: [
      { symbol: <NodeSymbol kind="class" />, text: 'Class', anchor: 'classes' },
      { symbol: <NodeSymbol kind="individual" />, text: 'Named resource or individual', anchor: 'individuals' },
      { symbol: <NodeSymbol kind="datatype" />, text: 'Datatype', anchor: 'datatypes' },
      { symbol: <NodeSymbol kind="literal" />, text: 'Literal value', anchor: 'literals' },
      { symbol: <NodeSymbol kind="blank" />, text: 'Blank node (OWL syntax)', anchor: 'blank-nodes' },
      { symbol: <NodeSymbol kind="connector" label="∩" />, text: 'List connector: ∩ ∪ oneOf', anchor: 'class-expressions' },
    ],
  },
  {
    title: 'Edges',
    rows: [
      { symbol: <EdgeSymbol tone="property" />, text: 'Property from the ontology', anchor: 'properties' },
      { symbol: <EdgeSymbol />, text: 'Built-in rdf / rdfs / owl relation (grey)', anchor: 'colors' },
      { symbol: <EdgeSymbol arrow="hollow" />, text: 'subClassOf', anchor: 'class-axioms' },
      { symbol: <EdgeSymbol line="dotted" />, text: 'Added connector or list-member edge', anchor: 'line-styles' },
    ],
  },
  {
    title: 'Marks on labels',
    marks: [
      { mark: '1st 2nd', text: 'position in a collapsed list', anchor: 'class-expressions' },
      { mark: '≡ ≢', text: 'equivalent / disjoint', anchor: 'class-axioms' },
      { mark: '[F] [T] [S]', text: 'property characteristics', anchor: 'property-characteristics' },
      { mark: '⛓', text: 'property chain (see side panel)', anchor: 'property-chains' },
    ],
  },
];

export default function Legend({ mode }) {
  const sections = mode === 'rdf' ? RDF_SECTIONS : OWL_SECTIONS;
  const view = mode === 'rdf' ? 'rdf-view' : 'owl-view';
  return (
    <div className="graph-legend-popover" role="dialog" aria-label="Graph legend">
      <div className="graph-legend-title">Legend · {mode === 'rdf' ? 'RDF view' : 'OWL view'}</div>
      {sections.map((section) => (
        <div key={section.title} className="graph-legend-section">
          <div className="graph-legend-heading">{section.title}</div>
          <div className="graph-legend-list">
            {(section.rows ?? []).map((row) => (
              <a key={row.text} className="graph-legend-item" href={docsUrl(row.anchor)} target="_blank" rel="noreferrer">
                <span className="graph-legend-symbol">{row.symbol}</span>
                <span>{row.text}</span>
              </a>
            ))}
            {(section.marks ?? []).map((row) => (
              <a key={row.text} className="graph-legend-item" href={docsUrl(row.anchor)} target="_blank" rel="noreferrer">
                <span className="graph-legend-symbol">
                  <MarkSymbol text={row.mark} />
                </span>
                <span>{row.text}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
      <a className="graph-legend-docs-link" href={docsUrl(view)} target="_blank" rel="noreferrer">
        Full usage guide ↗
      </a>
    </div>
  );
}
