import React, { useEffect, useState } from 'react';
import { EdgeSymbol, MarkSymbol, NodeSymbol, NOTATION_COLORS } from '../notation/symbols';

const TOC = [
  { id: 'overview', title: 'Overview' },
  { id: 'cheatsheet', title: 'Cheat sheet' },
  { id: 'views', title: 'The two views', children: [{ id: 'owl-view', title: 'OWL view' }, { id: 'rdf-view', title: 'RDF view' }] },
  {
    id: 'nodes',
    title: 'Nodes',
    children: [
      { id: 'classes', title: 'Classes' },
      { id: 'individuals', title: 'Individuals' },
      { id: 'datatypes', title: 'Datatypes' },
      { id: 'literals', title: 'Literals' },
      { id: 'class-expressions', title: 'Class expressions' },
      { id: 'enumerations', title: 'Enumerations' },
      { id: 'blank-nodes', title: 'Blank nodes (RDF view)' },
    ],
  },
  {
    id: 'edges',
    title: 'Edges',
    children: [
      { id: 'line-styles', title: 'Line styles and arrows' },
      { id: 'colors', title: 'Colours' },
      { id: 'class-axioms', title: 'Class axioms' },
      { id: 'properties', title: 'Properties' },
      { id: 'restrictions', title: 'Restrictions' },
      { id: 'cardinality', title: 'Cardinality' },
      { id: 'property-characteristics', title: 'Property characteristics' },
      { id: 'property-chains', title: 'Property chains' },
    ],
  },
  { id: 'hidden', title: 'What is not drawn' },
  { id: 'using', title: 'Using the viewer', children: [{ id: 'loading', title: 'Loading data' }, { id: 'layouts', title: 'Layouts and large graphs' }, { id: 'focus', title: 'Selecting and focusing' }, { id: 'search', title: 'Search and filters' }, { id: 'inspector', title: 'Entity inspector' }] },
];

// Shown inside the viewer (an iframe over it): ask the parent to close the overlay. Opened directly: navigate.
function goBackToViewer(event) {
  if (window.parent !== window) {
    event.preventDefault();
    window.parent.postMessage({ type: 'idea-guide-close' }, window.location.origin);
  }
}

function Section({ id, level = 2, title, children }) {
  const Tag = `h${level}`;
  return (
    <section id={id} className={`docs-section level-${level}`}>
      <Tag>
        <a className="docs-anchor" href={`#${id}`} aria-label={`Link to ${title}`}>
          #
        </a>
        {title}
      </Tag>
      {children}
    </section>
  );
}

function Pattern({ children }) {
  return <pre className="docs-pattern">{children}</pre>;
}

function Row({ symbol, name, children }) {
  return (
    <div className="docs-row">
      <div className="docs-row-symbol">{symbol}</div>
      <div className="docs-row-body">
        <strong>{name}</strong>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="docs-swatch">
      <i style={{ background: color }} />
      {label}
    </span>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const ids = TOC.flatMap((item) => [item.id, ...(item.children ?? []).map((child) => child.id)]);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '0px 0px -75% 0px' },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-shell">
      <nav className="docs-nav" aria-label="Contents">
        <a className="docs-back-button" href="./" onClick={goBackToViewer}>
          ← Go back to the viewer
        </a>
        <a className="brand-title" href="./" onClick={goBackToViewer} aria-label="IDEA* Viewer">
          <span className="brand-lockup">
            <span className="brand-word">IDEA</span>
            <span className="brand-star" aria-hidden="true">
              *
            </span>
          </span>
          <span className="brand-word brand-word-viewer">VIEWER</span>
        </a>
        <div className="docs-nav-sub">Usage guide</div>
        <ul>
          {TOC.map((item) => (
            <li key={item.id}>
              <a className={active === item.id ? 'active' : ''} href={`#${item.id}`}>
                {item.title}
              </a>
              {item.children ? (
                <ul>
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <a className={active === child.id ? 'active' : ''} href={`#${child.id}`}>
                        {child.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>

      <main className="docs-main">
        <Section id="overview" level={1} title="How to read a graph">
          <p className="docs-lead">
            idea* draws an ontology so that its structure can be read from shapes, lines and a few short marks instead of
            from a list of triples. The legend in the viewer lists the symbols you need most; this page is the complete
            reference. Every legend row links to the matching section here.
          </p>
          <div className="docs-callout">
            <strong>Four things carry most of the meaning.</strong>
            <ol>
              <li>
                <b>Shape</b> of a node says what kind of thing it is: rectangle = class, rounded rectangle = individual,
                triangle = datatype, circle = connector.
              </li>
              <li>
                <b>Line style</b> of an edge says what it relates: solid = between named things, dashed = to a literal or
                datatype, dotted = added by the viewer to draw a construct.
              </li>
              <li>
                <b>Colour</b> of an edge says whose relation it is: grey = built into RDF / RDFS / OWL, brown = defined by
                the ontology.
              </li>
              <li>
                <b>Marks</b> on a label, such as <MarkSymbol text="(some)" />, <MarkSymbol text="0..*" /> or{' '}
                <MarkSymbol text="[T]" />, add the logical detail.
              </li>
            </ol>
          </div>
        </Section>

        <Section id="cheatsheet" title="Cheat sheet">
          <table className="docs-table">
            <thead>
              <tr>
                <th>You see</th>
                <th>It means</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><NodeSymbol kind="class" /></td><td>class</td></tr>
              <tr><td><NodeSymbol kind="individual" /></td><td>named individual</td></tr>
              <tr><td><NodeSymbol kind="datatype" /></td><td>datatype</td></tr>
              <tr><td><NodeSymbol kind="literal" /></td><td>literal</td></tr>
              <tr><td><NodeSymbol kind="connector" label="∩" /></td><td>intersection (∪ union, ¬ complement)</td></tr>
              <tr><td><NodeSymbol kind="enumeration" /></td><td>owl:oneOf area</td></tr>
              <tr><td><EdgeSymbol tone="property" /></td><td>object property (ontology)</td></tr>
              <tr><td><EdgeSymbol tone="property" line="dashed" /></td><td>data property (ontology)</td></tr>
              <tr><td><EdgeSymbol arrow="hollow" /></td><td>subClassOf / subPropertyOf</td></tr>
              <tr><td><EdgeSymbol /></td><td>built-in rdf / rdfs / owl relation</td></tr>
              <tr><td><EdgeSymbol line="dotted" /></td><td>added by the viewer (connector or list member)</td></tr>
              <tr><td><MarkSymbol text="(some) (all)" /></td><td>restriction quantifier</td></tr>
              <tr><td><MarkSymbol text="* **" /></td><td>from subClassOf / from equivalentClass</td></tr>
              <tr><td><MarkSymbol text="0..*" /></td><td>cardinality (class side)</td></tr>
              <tr><td><MarkSymbol text="≡ ≢" /></td><td>equivalent / disjoint or different</td></tr>
              <tr><td><MarkSymbol text="[F] [IF] [T] [S]" /></td><td>functional, inverse functional, transitive, symmetric</td></tr>
              <tr><td><MarkSymbol text="⛓" /></td><td>property chain (read it in the side panel)</td></tr>
              <tr><td><MarkSymbol text="[+N]" /></td><td>N folded nodes beneath</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="views" title="The two views">
          <p>The same loaded data can be shown in either view. The toggle is in the graph toolbar; each view remembers its own layout.</p>
          <Section id="owl-view" level={3} title="OWL view">
            <p>
              The ontology as its author thinks of it. Properties are <em>edges</em> between the classes they connect (a
              property with a domain and a range becomes one labelled edge), restrictions are drawn on the property edge,
              and class expressions are drawn as small connectors. Labels use <code>rdfs:label</code> when there is one.
              Default layout: <b>Hierarchy</b>.
            </p>
          </Section>
          <Section id="rdf-view" level={3} title="RDF view">
            <p>
              Close to the raw triples: every resource is a node, every triple is a labelled edge. The OWL-specific
              simplifications are not applied, except that the plain lists behind <code>owl:unionOf</code>,{' '}
              <code>owl:intersectionOf</code> and <code>owl:oneOf</code> are folded into one list connector so they stay
              readable. Labels are local names (never <code>rdfs:label</code>). Default layout: <b>Spread</b>.
            </p>
          </Section>
        </Section>

        <Section id="nodes" title="Nodes">
          <p>A node’s <b>shape</b> is its kind. Size follows the text, so a long name gives a wider box.</p>
          <Section id="classes" level={3} title="Classes">
            <Row symbol={<NodeSymbol kind="class" />} name="Class (owl:Class)">
              Rectangle. Classes that are subclasses of others are joined by a hollow-arrow edge (see{' '}
              <a href="#class-axioms">class axioms</a>).
            </Row>
            <Row symbol={<NodeSymbol kind="thing" />} name="owl:Thing">
              Oval.
            </Row>
            <Pattern>{`?x a owl:Class .`}</Pattern>
            <p className="docs-note">
              A small badge at the corner of a node lists the classes an individual belongs to; hover it to fan the
              classes out. A <code>[+N]</code> in a label means the node has N more nodes folded beneath it (see{' '}
              <a href="#layouts">layouts</a>).
            </p>
          </Section>
          <Section id="individuals" level={3} title="Individuals">
            <Row symbol={<NodeSymbol kind="individual" />} name="Named individual / instance">
              Rounded rectangle with a brown border. In the RDF view, a property that appears as a node is drawn the same
              way (it is a named resource there).
            </Row>
            <Pattern>{`:ex a owl:NamedIndividual , :SomeClass .`}</Pattern>
            <p>Class membership is an unlabelled edge from the individual to its class (a small curved arrowhead).</p>
          </Section>
          <Section id="datatypes" level={3} title="Datatypes">
            <Row symbol={<NodeSymbol kind="datatype" />} name="Datatype">
              Triangle. A datatype you define yourself (<code>owl:equivalentClass</code> / <code>owl:oneOf</code> on a{' '}
              <code>rdfs:Datatype</code>) gets a heavier border. The XSD built-ins such as <code>xsd:decimal</code> are
              drawn when something uses them.
            </Row>
          </Section>
          <Section id="literals" level={3} title="Literals">
            <Row symbol={<NodeSymbol kind="literal" />} name="Literal value">
              Rectangle with a darker fill. The edge into it is dashed.
            </Row>
          </Section>
          <Section id="class-expressions" level={3} title="Class expressions">
            <p>Logical combinations of classes are drawn as a small circle with the operator inside.</p>
            <Row symbol={<NodeSymbol kind="connector" label="∩" />} name="Intersection ∩  ·  Union ∪  ·  Complement ¬">
              Dotted edges join the circle to its operands; where an operand is a class, the edge is a membership edge
              with a filled arrow. The class the expression defines points to the circle (a solid hollow-arrow edge for{' '}
              <code>subClassOf</code>, an <code>≡</code> edge for <code>equivalentClass</code>).
            </Row>
            <Pattern>{`:Mother owl:equivalentClass [ owl:intersectionOf ( :Woman :Parent ) ] .`}</Pattern>
            <p>
              In the OWL view a restriction that is part of the expression is drawn as a property edge that leaves the
              circle. In the RDF view the list is folded into one list connector whose edges are numbered{' '}
              <MarkSymbol text="1st" />, <MarkSymbol text="2nd" />, …
            </p>
          </Section>
          <Section id="enumerations" level={3} title="Enumerations">
            <Row symbol={<NodeSymbol kind="enumeration" />} name="owl:oneOf">
              A dashed rectangular area containing every member. The class it defines is connected to the area with an{' '}
              <code>owl:oneOf</code> label.
            </Row>
          </Section>
          <Section id="blank-nodes" level={3} title="Blank nodes (RDF view)">
            <Row symbol={<NodeSymbol kind="blank" />} name="Blank node">
              Small unlabelled circle: an anonymous resource such as a restriction or a list cell. Where the structure is
              recognised (lists, property chains) it is folded away instead.
            </Row>
          </Section>
        </Section>

        <Section id="edges" title="Edges">
          <Section id="line-styles" level={3} title="Line styles and arrows">
            <div className="docs-grid">
              <Row symbol={<EdgeSymbol tone="property" />} name="Solid">
                Between two named things (class, individual, …).
              </Row>
              <Row symbol={<EdgeSymbol tone="property" line="dashed" />} name="Dashed">
                To or from a literal or datatype (data properties).
              </Row>
              <Row symbol={<EdgeSymbol line="dotted" />} name="Dotted + filled arrow">
                Not a statement the author wrote as a relation: the viewer added it to draw a construct. Connector →
                operand edges, list members, and links between property edges.
              </Row>
              <Row symbol={<EdgeSymbol arrow="hollow" />} name="Hollow arrowhead">
                Specialisation: <code>subClassOf</code> and <code>subPropertyOf</code>.
              </Row>
              <Row symbol={<EdgeSymbol />} name="Filled arrowhead">
                An ordinary relation; the arrow points to the object (range).
              </Row>
            </div>
          </Section>
          <Section id="colors" level={3} title="Colours">
            <p>
              <Swatch color={NOTATION_COLORS.base} label="Grey" />: relations defined by the RDF, RDFS and OWL
              vocabularies themselves (<code>rdf:type</code>, <code>rdfs:subClassOf</code>, <code>owl:equivalentClass</code>,{' '}
              <code>owl:sameAs</code>, …).
            </p>
            <p>
              <Swatch color={NOTATION_COLORS.property} label="Brown" />: relations defined by the ontology you loaded (
              <code>hasPart</code>, <code>locatedIn</code>, …). Only these are brown.
            </p>
          </Section>
          <Section id="class-axioms" level={3} title="Class axioms">
            <Row symbol={<EdgeSymbol arrow="hollow" />} name="subClassOf">
              Solid line, hollow arrowhead, from the subclass to the superclass.
            </Row>
            <Row symbol={<EdgeSymbol mark="≡" />} name="equivalentClass  ≡">
              Labelled <MarkSymbol text="≡" />. Drawn as an asserted edge, not an added one.
            </Row>
            <Row symbol={<EdgeSymbol mark="≢" />} name="disjointWith  ≢">
              Labelled <MarkSymbol text="≢" />.
            </Row>
            <Pattern>{`:Cat rdfs:subClassOf :Animal .
:Cat owl:disjointWith :Dog .`}</Pattern>
            <p>Individuals use the same marks: <code>owl:sameAs</code> is <MarkSymbol text="≡" />, <code>owl:differentFrom</code> is <MarkSymbol text="≢" />, and <code>owl:AllDifferent</code> is a circle containing <MarkSymbol text="≢" /> joined to every member.</p>
          </Section>
          <Section id="properties" level={3} title="Properties">
            <Row symbol={<EdgeSymbol tone="property" />} name="Object property">
              Solid edge from the domain class to the range class, labelled with the property name.
            </Row>
            <Row symbol={<EdgeSymbol tone="property" line="dashed" />} name="Data property">
              Dashed edge to a datatype (or to a literal when it is an assertion).
            </Row>
            <Pattern>{`:hasPart a owl:ObjectProperty ; rdfs:domain :Whole ; rdfs:range :Part .`}</Pattern>
            <p>
              <code>subPropertyOf</code>, <code>equivalentProperty</code> and <code>inverseOf</code> join the{' '}
              <em>property edges</em> (centre to centre) with a dotted edge labelled with the relation, such as{' '}
              <code>{'<<inverseOf>>'}</code>. Annotation properties are not drawn; they appear in the side panel.
            </p>
          </Section>
          <Section id="restrictions" level={3} title="Restrictions">
            <p>
              A restriction on a class is drawn on the <em>property edge itself</em>, so you can see which class carries
              it and what it points to.
            </p>
            <div className="docs-grid">
              <Row symbol={<MarkSymbol text="(some) p" />} name="someValuesFrom">
                At least one value of the target. Prefix <code>(some)</code>.
              </Row>
              <Row symbol={<MarkSymbol text="(all) p" />} name="allValuesFrom">
                Every value is of the target. Prefix <code>(all)</code>.
              </Row>
              <Row symbol={<MarkSymbol text="p*" />} name="Restriction via subClassOf">
                A trailing <code>*</code> marks an edge that comes from a restriction the class <em>inherits</em> (a
                necessary condition).
              </Row>
              <Row symbol={<MarkSymbol text="p**" />} name="Restriction via equivalentClass">
                A trailing <code>**</code>: the restriction is part of the class’s definition (necessary and sufficient).
              </Row>
            </div>
            <Pattern>{`:Hospital rdfs:subClassOf [ a owl:Restriction ;
    owl:onProperty :hasPart ; owl:someValuesFrom :Ward ] .`}</Pattern>
            <p>
              <code>hasSelf</code> restrictions keep a small circle on the edge. Hover any edge to read the restriction
              as a sentence, for example <code>Hospital SubClassOf hasPart some Ward</code>.
            </p>
          </Section>
          <Section id="cardinality" level={3} title="Cardinality">
            <p>Cardinality restrictions are written UML-style, <b>on the class side of the property edge</b>.</p>
            <div className="docs-grid">
              <Row symbol={<MarkSymbol text="0..1" />} name="maxCardinality 1">
                at most one
              </Row>
              <Row symbol={<MarkSymbol text="2..*" />} name="minCardinality 2">
                at least two
              </Row>
              <Row symbol={<MarkSymbol text="3" />} name="cardinality 3">
                exactly three
              </Row>
            </div>
            <p>Qualified cardinalities draw the edge to the qualifying class or datatype.</p>
          </Section>
          <Section id="property-characteristics" level={3} title="Property characteristics">
            <p>Characteristics are written as a prefix on the property label:</p>
            <div className="docs-grid">
              <Row symbol={<MarkSymbol text="[F]" />} name="Functional" />
              <Row symbol={<MarkSymbol text="[IF]" />} name="Inverse functional" />
              <Row symbol={<MarkSymbol text="[T]" />} name="Transitive" />
              <Row symbol={<MarkSymbol text="[S]" />} name="Symmetric" />
            </div>
            <p>They combine: <code>[F] [T] partOf</code>.</p>
          </Section>
          <Section id="property-chains" level={3} title="Property chains">
            <Row symbol={<MarkSymbol text="⛓ p" />} name="owl:propertyChainAxiom">
              The property edge gets a <MarkSymbol text="⛓" /> prefix. Click the edge: the side panel shows the chain,
              for example <code>hasServiceComponent o connectsTo -&gt; serversRoom</code> (read: following{' '}
              <code>hasServiceComponent</code> and then <code>connectsTo</code> implies <code>serversRoom</code>).
            </Row>
            <Pattern>{`:serversRoom owl:propertyChainAxiom ( :hasServiceComponent :connectsTo ) .`}</Pattern>
            <p>
              The RDF list that stores the chain is not drawn, in either view. A property used only inside a chain is
              not drawn on its own either. An inverse step is written <code>inverse p</code>. A property with a chain
              but no domain and range has no edge to carry the mark.
            </p>
          </Section>
        </Section>

        <Section id="hidden" title="What is not drawn">
          <ul>
            <li>
              <b>Vocabulary terms used as types</b>: <code>owl:Class</code>, <code>owl:Restriction</code>,{' '}
              <code>owl:ObjectProperty</code>, … Their meaning is carried by the shape. <code>owl:Thing</code>,{' '}
              <code>rdfs:Resource</code> and <code>rdfs:Literal</code> are drawn.
            </li>
            <li>Isolated built-in terms with no relations.</li>
            <li>
              <b>Annotations</b> (labels, definitions, comments, custom annotation properties) and ontology metadata:
              shown in the side panel only.
            </li>
            <li>Built-in datatypes that nothing uses.</li>
            <li>The RDF lists that encode chains and class expressions (folded into connectors or marks).</li>
          </ul>
        </Section>

        <Section id="using" title="Using the viewer">
          <Section id="loading" level={3} title="Loading data">
            <p>
              Open <b>Load Data</b> in the left panel: upload files (<code>.ttl .rdf .owl .n3 .nt .nq .trig</code>) or
              paste a <b>URL</b>. A GitHub <code>blob</code> link is turned into the raw file. The server must allow
              cross-origin reads (CORS); there is no proxy, so the data stays in your browser. The loaded address becomes
              the base IRI, so <code>&lt;&gt;</code> resolves to it.
            </p>
          </Section>
          <Section id="layouts" level={3} title="Layouts and large graphs">
            <ul>
              <li>
                <b>Hierarchy</b> (default for OWL view): layered, top to bottom. Good for taxonomies and DAGs.
              </li>
              <li>
                <b>Spread</b> (default for RDF view): force-directed, deterministic. Good for networks.
              </li>
              <li>
                Graphs over 150 nodes open <b>folded</b>. In Hierarchy a node showing <MarkSymbol text="[+N]" /> hides N
                descendants; double-click to expand or collapse. In Spread, communities are folded into group boxes;
                double-click a group to expand it and a member to fold it back.
              </li>
              <li>Both layouts show the same nodes and edges. Filters keep positions stable.</li>
            </ul>
          </Section>
          <Section id="focus" level={3} title="Selecting and focusing">
            <p>
              Click a node to focus its neighbourhood; the rest fades. The neighbourhood continues through connectors
              (blank nodes, <MarkSymbol text="∩" /> <MarkSymbol text="∪" />, list cells), because a connector alone says
              nothing, up to the first real nodes behind them. Click an
              edge to inspect that edge.
            </p>
          </Section>
          <Section id="search" level={3} title="Search and filters">
            <p>
              <b>Find</b> (Ctrl/⌘ + F) searches what is currently visible, over classes, object properties, data
              properties, datatypes and individuals; the chips under the box switch each kind on or off. Enter / Shift+Enter
              move between matches. The left panel filters by class type, base IRI, node name, named graph and SPARQL.
            </p>
          </Section>
          <Section id="inspector" level={3} title="Entity inspector">
            <p>The right panel describes the selection.</p>
            <ul>
              <li>
                <b>Annotation properties</b>: labels, definitions and other annotations.
              </li>
              <li>
                <b>Data properties</b>: literal values, plus the data properties a class carries through restrictions.
              </li>
              <li>
                <b>Object properties</b>: the object properties attached to the class, incoming or outgoing. Click one
                to select that property’s edge.
              </li>
              <li>
                <b>Unprocessed statements</b>: statements the viewer did not draw, so nothing is silently lost.
              </li>
              <li>For an edge: its axiom kind, predicate IRI, source, target and extra metadata such as a property chain.</li>
            </ul>
          </Section>
        </Section>

      </main>
    </div>
  );
}
