const supportedTypes = ['BlogPost','CategoryTree','SimpleProduct','Products'];

function* traverse(value, key = null, parent = null) {
  if (isArray(value)) {
    yield *traverseArray(value);
  } else if ((typeof value === 'object') && (value !== null)) {
    yield *traverseObject(value);
  } else {
    if (key === '__typename' && supportedTypes.includes(value)) {
        switch (value) {
          case 'BlogPost':
            yield `BP${parent.post_id}`;
            break;
          case 'CategoryTree':
            yield `C${parent.id || ''}`;
            break;
          case 'SimpleProduct':
              yield `P${parent.id}`;
              break;
          case 'Products':
              yield 'P';
              break;
          default:
            yield value;
        }
    }
  }
}

function *traverseArray(arr) {
  for (let value of arr) {
    yield *traverse(value);
  }
}

function *traverseObject(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      yield *traverse(obj[key], key, obj);
    }
  }
}

function isArray(o) {
  return Array.isArray(o);
}

module.exports = { traverse };
