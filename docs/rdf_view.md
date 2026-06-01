# RDF View Specification

This document describes the RDF View rendering rules parsed from the uploaded ontology-pattern table. The RDF View is intentionally close to the raw RDF triple structure: most constructs are rendered as nodes and labeled edges without the additional OWL-specific visual simplifications used in OWL View.

## 1. Global RDF View Rules

### Node labels

- Display named nodes using their local name.
- Display literal nodes using their literal value.
- Do not substitute `rdfs:label` values for node names in RDF View.

### Edge styling

- RDF View does not use the OWL View style distinctions between straight, dashed, and dotted edges.
- RDF View does not use the OWL View color distinctions between standard RDF/OWL relations and custom ontology relations.
- Relations are generally shown as direct labeled edges between RDF nodes.

---

## 2. Classes

### Class declaration

**Pattern**

```turtle
?x a owl:Class .
```

**RDF View**

- Render the class node as a rectangle.
- The `rdf:type` / `a` relationship may be represented as a regular labeled edge if the full RDF structure is shown.

---

## 3. Class Descriptions

### Enumeration with `owl:oneOf`

**Pattern**

```turtle
?x a owl:Class ;
   owl:equivalentClass [
      a owl:Class ;
      owl:oneOf (
         ?y
         ?z
      )
   ] .
```

**RDF View**

- Show a labeled edge from the source class to the `owl:oneOf` blank node.
- The edge label should be `owl:oneOf`.
- Represent the RDF list structure explicitly.
- The list should be shown through recursive RDF list triples using:
  - `rdf:first`
  - `rdf:rest`
  - `rdf:nil`
- Do not collapse the list into a dashed visual group as in OWL View.

---

### Value constraints / property restrictions

**Pattern**

```turtle
?x a owl:Class ;
   rdfs:subClassOf ?y ,
      [ a owl:Restriction ;
        owl:onProperty ?p ;
        owl:someValuesFrom ?k
      ] .
```

Possible restriction predicates include:

```turtle
owl:someValuesFrom
owl:allValuesFrom
owl:hasValue
```

**RDF View**

- Represent the restriction as a blank node.
- Show every restriction component as RDF triples connected to that blank node.
- The blank node should connect to:
  - `owl:Restriction` through `rdf:type` / `a`
  - the restricted property through `owl:onProperty`
  - the target class, value, or datatype through the relevant restriction predicate.
- Do not rewrite the restriction as a decorated property edge.

---

### Cardinality constraints

**Pattern**

```turtle
?x a owl:Class ;
   rdfs:subClassOf ?y ,
      [ a owl:Restriction ;
        owl:onProperty ?p ;
        owl:maxCardinality ?n
      ] .
```

Possible cardinality predicates include:

```turtle
owl:maxCardinality
owl:minCardinality
owl:cardinality
owl:hasCardinality
```

**RDF View**

- Represent the cardinality restriction as a blank node.
- Show the complete restriction as triples.
- Connect the source class to the blank restriction node with `rdfs:subClassOf`.
- Connect the restriction node to:
  - `owl:Restriction`
  - the property via `owl:onProperty`
  - the cardinality literal via the relevant cardinality predicate.
- Do not use UML multiplicity notation in RDF View.

---

### Class expressions

**Pattern**

```turtle
?x owl:equivalentClass [
   owl:intersectionOf (
      ?y
      ?z
   )
] .
```

Related predicates include:

```turtle
owl:intersectionOf
owl:unionOf
owl:complementOf
```

**RDF View**

- Represent the expression using the underlying RDF triples.
- Use a blank node for the class expression when the source uses a blank node.
- For `owl:intersectionOf` and `owl:unionOf`, show the RDF list explicitly using `rdf:first`, `rdf:rest`, and `rdf:nil`.
- For `owl:complementOf`, show the blank node connected to the complemented class with an `owl:complementOf` labeled edge.
- Do not replace the expression with connector circles or symbolic merge nodes.

---

## 4. Class Axioms

### `rdfs:subClassOf`

**Pattern**

```turtle
?x rdfs:subClassOf ?y .
```

**RDF View**

- Show an edge connecting the two class nodes.
- RDF View does not apply the OWL View hollow-triangle hierarchy style.

---

### Equivalent class

**Pattern**

```turtle
?x owl:equivalentClass ?y .
```

**RDF View**

- Show an edge connecting the two class nodes.
- The relation should remain visible as a standard RDF edge rather than a special equivalence-symbol edge.

---

### Disjoint classes

**Pattern**

```turtle
?x owl:disjointWith ?y .
```

**RDF View**

- Show an edge connecting the two class nodes.
- The relation should remain visible as a standard RDF edge rather than a special inequality-symbol edge.

---

## 5. Properties

### Object property

**Pattern**

```turtle
?p a owl:ObjectProperty ;
   rdfs:domain ?domain ;
   rdfs:range ?range ;
   owl:inverseOf ?inverseProperty .
```

`rdfs:domain`, `rdfs:range`, and `owl:inverseOf` are optional.

**RDF View**

- Show property usage as an edge labeled with the property name.
- When displaying the property definition itself, show RDF triples for:
  - property type
  - domain
  - range
  - inverse property, when present.

---

### Datatype property

**Pattern**

```turtle
?p a owl:DatatypeProperty ;
   rdfs:domain ?domain ;
   rdfs:range ?datatype .
```

`rdfs:domain` and `rdfs:range` are optional.

**RDF View**

- Show property usage as an edge labeled with the property name.
- When displaying the property definition itself, show RDF triples for:
  - property type
  - domain
  - range.
- RDF View does not require a dashed visual edge for datatype properties.

---

### Annotation property

**Pattern**

```turtle
?p a owl:AnnotationProperty .
```

**RDF View**

- Show custom annotation properties in the side panel.
- Annotation assertions are also shown in the side panel rather than emphasized in the graph.

---

## 6. RDF Schema Property Constructs

### `rdfs:subPropertyOf`

**Pattern**

```turtle
?p1 rdfs:subPropertyOf ?p2 .
```

The properties may be object properties, datatype properties, or annotation properties.

**RDF View**

- Show an edge between the two property nodes or property edges.
- RDF View does not require the OWL View dotted meta-edge styling.

---

### `rdfs:domain`

**Pattern**

```turtle
?p rdfs:domain ?class .
```

**RDF View**

- Show the domain by the starting position of the corresponding property edge when visualizing property usage.
- When showing raw property definitions, show `rdfs:domain` as a labeled RDF edge.

---

### `rdfs:range`

**Pattern**

```turtle
?p rdfs:range ?classOrDatatype .
```

**RDF View**

- Show the range by the ending position of the corresponding property edge when visualizing property usage.
- When showing raw property definitions, show `rdfs:range` as a labeled RDF edge.

---

## 7. Relations Between Properties

### Equivalent property

**Pattern**

```turtle
?p1 owl:equivalentProperty ?p2 .
```

**RDF View**

- Show an edge between the two property nodes or property edges.

---

### Inverse property

**Pattern**

```turtle
?p1 owl:inverseOf ?p2 .
```

**RDF View**

- Show an edge between the two property nodes or property edges.
- Keep the predicate label visible as `owl:inverseOf`.

---

## 8. Property Characteristics

### Functional property

**Pattern**

```turtle
?p a owl:FunctionalProperty .
```

**RDF View**

- Show only in the side panel.
- Do not add prefix symbols to the property edge.

---

### Inverse functional property

**Pattern**

```turtle
?p a owl:InverseFunctionalProperty .
```

**RDF View**

- Show only in the side panel.
- Do not add prefix symbols to the property edge.

---

### Transitive property

**Pattern**

```turtle
?p a owl:TransitiveProperty .
```

**RDF View**

- Show only in the side panel.
- Do not add prefix symbols to the property edge.

---

### Symmetric property

**Pattern**

```turtle
?p a owl:SymmetricProperty .
```

**RDF View**

- Show only in the side panel.
- Do not add prefix symbols to the property edge.

---

## 9. Individuals

### Named individual

**Pattern**

```turtle
?x a ?Class .
```

**RDF View**

- Render named individuals as rounded rectangles.

---

### `owl:Thing`

**Pattern**

```turtle
?x a owl:Thing .
```

**RDF View**

- Render as an oval.

---

### Class membership

**Pattern**

```turtle
?x a ?Class .
```

**RDF View**

- Show an edge between the individual node and the class node.
- Label the edge with `typeOf` or the equivalent type relation label used by the implementation.

---

### Property values

**Pattern**

```turtle
?s ?p ?o .
```

**RDF View**

- Show an edge between the subject node and object node.
- Use the predicate as the edge label.
- RDF View does not require different edge styles for object-property and datatype-property assertions.

---

## 10. Individual Identity

### Same individual

**Pattern**

```turtle
?s owl:sameAs ?o .
```

**RDF View**

- Show a labeled edge between the two individual nodes.

---

### Different individuals

**Pattern**

```turtle
?s owl:differentFrom ?o .
```

**RDF View**

- Show a labeled edge between the two individual nodes.

---

### All different

**Pattern**

```turtle
_:x a owl:AllDifferent ;
   owl:members (...)
```

**RDF View**

- Create a blank node for the `owl:AllDifferent` axiom.
- Connect all related individuals to that blank node.
- If the individuals are represented as an RDF list, show the list through `rdf:first`, `rdf:rest`, and `rdf:nil`.

---

## 11. Datatypes

### RDF / OWL built-in datatypes

Examples:

```turtle
xsd:string
xsd:int
rdf:langString
```

**RDF View**

- Do not display built-in RDF/OWL datatypes as standalone graph nodes.

---

### Enumerated datatype

**Pattern**

```turtle
?t a owl:Datatype .
```

**RDF View**

- Render the datatype node as a triangle.

---

## 12. Annotations

### Built-in annotation properties

Examples:

```turtle
owl:versionInfo
rdfs:label
rdfs:comment
rdfs:seeAlso
rdfs:isDefinedBy
```

**RDF View**

- Do not display these directly in the main graph.

---

### Custom annotation property

**Pattern**

```turtle
?a a owl:AnnotationProperty .
```

**RDF View**

- Show in the side panel.

---

### Annotation assertions

**Pattern**

```turtle
?s ?annotationProperty ?o .
```

**RDF View**

- Show in the side panel.

---

## 13. Ontology Metadata

The following are shown in the side panel:

- ontology header information
- imported ontologies
- version information

---

## 14. Summary

RDF View should prioritize faithful visualization of the underlying RDF graph. It should avoid OWL-specific abstractions such as decorated property edges, multiplicity labels, symbolic connector circles, dashed enumeration containers, and special color/style distinctions. Blank nodes, RDF lists, and explicit predicate-labeled edges should remain visible so that users can inspect the actual triple structure.
