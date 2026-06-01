
# OWL View Specification

## 1. Classes

### Class Declaration

**Pattern**

```turtle
?x a owl:Class .
```

**OWL View**

* Render as a **rectangle**.

---

## 2. Class Descriptions

### Enumerated Classes (`owl:oneOf`)

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

**OWL View**

* Create a **dashed rectangular area** containing all members of the enumeration.
* Connect the source class to that area.
* Label the connection:

```text
owl:oneOf
```

* Enumeration members may be classes or individuals.

---

### Class Expressions

#### Intersection (`owl:intersectionOf`)

**Pattern**

```turtle
?x owl:equivalentClass [
      owl:intersectionOf (
         ?y
         ?z
      )
   ] .
```

**OWL View**

* Use a **connector circle**.
* Put an **intersection symbol** inside the circle.
* Connect source and target classes through the circle.
* Use **dotted edges** for these connections.

---

#### Union (`owl:unionOf`)

**Pattern**

```turtle
?x owl:equivalentClass [
      owl:unionOf (...)
   ] .
```

**OWL View**

* Same structure as intersection.
* Connector circle contains a **union symbol**.
* Connections use **dotted edges**.

---

#### Complement (`owl:complementOf`)

**Pattern**

```turtle
?x owl:equivalentClass [
      owl:complementOf ?y
   ] .
```

**OWL View**

* Connector circle contains a **complement / negation symbol**.
* Connections use **dotted edges**.

---

## 3. Property Restrictions on Classes

### Existential Restriction (`owl:someValuesFrom`)

**Pattern**

```turtle
?x a owl:Class ;
   rdfs:subClassOf [
      a owl:Restriction ;
      owl:onProperty ?p ;
      owl:someValuesFrom ?y
   ] .
```

**OWL View**

* Represent using the property edge itself.
* Prefix the property label with:

```text
(some)
```

Example:

```text
(some) hasPart
```

---

### Universal Restriction (`owl:allValuesFrom`)

**Pattern**

```turtle
?x a owl:Class ;
   rdfs:subClassOf [
      a owl:Restriction ;
      owl:onProperty ?p ;
      owl:allValuesFrom ?y
   ] .
```

**OWL View**

* Represent using the property edge.
* Prefix the property label with:

```text
(all)
```

Example:

```text
(all) hasPart
```

---

### Value Restriction (`owl:hasValue`)

**Pattern**

```turtle
?x a owl:Class ;
   rdfs:subClassOf [
      a owl:Restriction ;
      owl:onProperty ?p ;
      owl:hasValue ?v
   ] .
```

**OWL View**

* Represent using the property edge.
* Add a trailing:

```text
*
```

to the property label.

Example:

```text
hasStatus*
```

* Connect to the target entity or enumerated set.

---

## 4. Cardinality Restrictions

### Maximum Cardinality

**Pattern**

```turtle
?x a owl:Class ;
   rdfs:subClassOf [
      a owl:Restriction ;
      owl:onProperty ?p ;
      owl:maxCardinality ?n
   ] .
```

**OWL View**

* Show UML-style multiplicity on the class side.

Example:

```text
0..1
1
2
*
```

---

### Minimum Cardinality

**Pattern**

```turtle
owl:minCardinality ?n
```

**OWL View**

* Same UML multiplicity notation.

---

### Exact Cardinality

**Pattern**

```turtle
owl:cardinality ?n
```

**OWL View**

* Same UML multiplicity notation.

---

## 5. Class Axioms

### Subclass Relation

**Pattern**

```turtle
?x rdfs:subClassOf ?y .
```

**OWL View**

* Specialized hierarchy edge.
* Hollow triangle arrowhead.
* OWL/RDFS relation color.

---

### Equivalent Classes

**Pattern**

```turtle
?x owl:equivalentClass ?y .
```

**OWL View**

* Edge labeled with a **triple-equals symbol**.
* OWL/RDFS relation color.

---

### Disjoint Classes

**Pattern**

```turtle
?x owl:disjointWith ?y .
```

**OWL View**

* Edge labeled with a **triple-not-equals symbol**.
* OWL/RDFS relation color.

---

# 6. Properties

## Object Property

**Pattern**

```turtle
?p a owl:ObjectProperty ;
   rdfs:domain ?domain ;
   rdfs:range ?range .
```

**OWL View**

* Straight edge.
* Property name shown as edge label.
* Uses ontology-property color.

---

## Datatype Property

**Pattern**

```turtle
?p a owl:DatatypeProperty ;
   rdfs:domain ?domain ;
   rdfs:range ?datatype .
```

**OWL View**

* Dashed edge.
* Property name shown as edge label.
* Uses ontology-property color.

---

## Subproperty Hierarchy

**Pattern**

```turtle
?p1 rdfs:subPropertyOf ?p2 .
```

**OWL View**

* Dotted edge between property edges.
* Connect center of child property edge to center of parent property edge.
* Label:

```text
<<subPropertyOf>>
```

---

## Equivalent / Inverse Properties

### Equivalent Property

**Pattern**

```turtle
?p1 owl:equivalentProperty ?p2 .
```

### Inverse Property

**Pattern**

```turtle
?p1 owl:inverseOf ?p2 .
```

**OWL View**

* Dotted edge between property edges.
* Connect edge centers.
* Label according to relation.

Example:

```text
<<inverseOf>>
```

---

## Global Cardinality Property Characteristics

### Functional Property

**Pattern**

```turtle
?p a owl:FunctionalProperty .
```

**OWL View**

* Display as a **prefix symbol** on the property edge.

---

### Inverse Functional Property

**Pattern**

```turtle
?p a owl:InverseFunctionalProperty .
```

**OWL View**

* Display as a **prefix symbol** on the property edge.

---

## Logical Property Characteristics

### Transitive Property

**Pattern**

```turtle
?p a owl:TransitiveProperty .
```

**OWL View**

* Display as a **prefix symbol** on the property edge.

---

### Symmetric Property

**Pattern**

```turtle
?p a owl:SymmetricProperty .
```

**OWL View**

* Display as a **prefix symbol** on the property edge.

---

# 7. Individuals

## Named Individual

**Pattern**

```turtle
?x a ?Class .
```

**OWL View**

* Rounded rectangle (rectangle with curved corners).

---

## `owl:Thing`

**Pattern**

```turtle
?x a owl:Thing .
```

**OWL View**

* Oval.

---

## Class Membership

**Pattern**

```turtle
?x a ?Class .
```

**OWL View**

* Unlabeled straight edge.
* Uses OWL/RDF relation color.

---

## Property Assertions

### Object Property Assertion

**Pattern**

```turtle
?s ?p ?o .
```

where object is an IRI.

**OWL View**

* Straight edge.
* Property name as label.
* Ontology-property color.

---

### Datatype Property Assertion

**Pattern**

```turtle
?s ?p ?literal .
```

**OWL View**

* Dashed edge.
* Property name as label.
* Ontology-property color.

---

## Individual Identity

### Same Individual

**Pattern**

```turtle
?s owl:sameAs ?o .
```

**OWL View**

* Dotted edge.
* Equivalence label.

---

### Different Individuals

**Pattern**

```turtle
?s owl:differentFrom ?o .
```

**OWL View**

* Dotted edge.
* Inequality label.

---

### All Different

**Pattern**

```turtle
_:x a owl:AllDifferent .
```

**OWL View**

* Create a special blank node.
* Place inequality symbol inside it.
* Connect all participating individuals to that node.

---

# 8. Datatypes

## Enumerated Datatype

**Pattern**

```turtle
?t a owl:Datatype .
```

**OWL View**

* Triangle node.

---

## RDF / OWL Built-in Datatypes

**Pattern**

Built-in datatypes such as:

```turtle
xsd:string
xsd:int
rdf:langString
```

**OWL View**

* Not displayed.

---

# 9. Annotations

## Custom Annotation Property

**Pattern**

```turtle
?a a owl:AnnotationProperty .
```

**OWL View**

* Display only in the side panel.

---

## Annotation Assertions

**Pattern**

```turtle
?s ?annotationProperty ?o .
```

**OWL View**

* Display only in the side panel.

---

## Built-in Annotation Properties

Examples:

```turtle
rdfs:label
rdfs:comment
rdfs:seeAlso
rdfs:isDefinedBy
owl:versionInfo
```

**OWL View**

* Not shown directly in the graph.
* Managed through labels/side information.

---

# 10. Ontology Metadata

The following are displayed only in a side panel:

* Ontology header information
* Imported ontologies
* Version information

---

# Global OWL View Styling Rules

## Node Labels

**OWL View**

* Prefer `rdfs:label` when available.

**RDF View**

* Always use local names or literal values.

---

## Edge Styles

### Straight Edge

Represents:

```text
IRI → IRI
```

relationships.

---

### Dashed Edge

Represents:

```text
IRI → Literal
Literal → IRI
Literal → Literal
```

relationships.

---

### Dotted Edge

Represents inferred or synthetic OWL constructs such as:

* `owl:intersectionOf`
* `owl:unionOf`
* `owl:complementOf`
* `owl:sameAs`
* `owl:differentFrom`
* `owl:AllDifferent`
* property-to-property meta-relations

---

## Edge Colors

### OWL/RDF Property Color

Used for:

* standard OWL properties
* standard RDF/RDFS properties

Examples:

```text
rdf:type
rdfs:subClassOf
owl:equivalentClass
owl:sameAs
```

---

### Ontology Property Color (brown)

Used for:

* user-defined ontology relations

Examples:

```text
hasPart
worksFor
locatedIn
hasName
```

Source: uploaded table parsing. 
