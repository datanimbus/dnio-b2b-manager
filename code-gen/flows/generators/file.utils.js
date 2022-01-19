function getContent(flowData) {
  const code = [];
  const blocks = flowData.blocks;
  blocks.forEach(node => {
    let schemaId;
    if (node.target) {
      schemaId = node.target;
    } else {
      schemaId = node.source;
    }
    if (node && (node.meta.targetType === 'FILE' || node.meta.sourceType === 'FILE')) {
      const structure = flowData.structures[schemaId].structure;
      // Function to return array of values;
      code.push(`function getValuesOf${schemaId} (data) {`);
      code.push('\tconst values = [];')
      Object.keys(structure).forEach(key => {
        const properties = structure[key].properties;
        code.push(`values.push(data['${properties.dataKey}'] || '');`);
      });
      code.push('\treturn values;')
      code.push('}')
      // Function to return array of headers;
      code.push(`function getHeaderOf${schemaId} () {`);
      code.push('\tconst headers = [];')
      Object.keys(structure).forEach(key => {
        const properties = structure[key].properties;
        code.push(`headers.push('${properties.name}');`);
      });
      code.push('\treturn headers;')
      code.push('}')

      code.push(`function readFlatFile${schemaId} (value) {`);
      code.push('\tconst json = {};')
      code.push('\tif (!value) {')
      code.push('\tvalue = \'\';')
      code.push('\t}')
      Object.keys(structure).forEach((key, i, a) => {
        const properties = structure[key].properties;
        let index = 0, length = 0, arr = a.slice(0);
        if (i > 0) {
          index = arr.splice(0, i).reduce((p, c) => structure[c].properties.fieldLength + p, 0);
        }
        length = properties.fieldLength;
        code.push(`json['${properties.name}'] = value.substr(${index}, ${length}).trim();`);
      });
      code.push('\treturn json;')
      code.push('}')


      code.push(`function writeFlatFile${schemaId} (json) {`);
      code.push('\tlet value = \'\';')
      code.push('\tif (!json) {')
      code.push('\tjson = {};')
      code.push('\t}')
      Object.keys(structure).forEach((key) => {
        const properties = structure[key].properties;
        let length = properties.fieldLength;
        code.push(`value += (json['${properties.name}'] == null ? '' : json['${properties.name}']+'').padEnd(${length}).substr(0, ${length});`);
      });
      code.push('\treturn value;')
      code.push('}')

      code.push(`module.exports.getValuesOf${schemaId} = getValuesOf${schemaId}`)
      code.push(`module.exports.getHeaderOf${schemaId} = getHeaderOf${schemaId}`)
      code.push(`module.exports.readFlatFile${schemaId} = readFlatFile${schemaId}`)
      code.push(`module.exports.writeFlatFile${schemaId} = writeFlatFile${schemaId}`)
    }
  });
  return code.join('\n');
}


module.exports.getContent = getContent;
