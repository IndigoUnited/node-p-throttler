# p-throttler

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

[npm-url]:https://npmjs.org/package/p-throttler
[downloads-image]:http://img.shields.io/npm/dm/p-throttler.svg
[npm-image]:http://img.shields.io/npm/v/p-throttler.svg
[travis-url]:https://travis-ci.org/IndigoUnited/node-p-throttler
[travis-image]:http://img.shields.io/travis/IndigoUnited/node-p-throttler/master.svg
[david-dm-url]:https://david-dm.org/IndigoUnited/node-p-throttler
[david-dm-image]:https://img.shields.io/david/IndigoUnited/node-p-throttler.svg
[david-dm-dev-url]:https://david-dm.org/IndigoUnited/node-p-throttler#info=devDependencies
[david-dm-dev-image]:https://img.shields.io/david/dev/IndigoUnited/node-p-throttler.svg

A promise based throttler responsible for limiting execution of parallel tasks.
The number of parallel tasks may be limited and configured per type.


## Installation

`$ npm install p-throttler`


## API

### #create(defaultConcurrency, types)

Constructs a new throttler.

The `defaultConcurrency` is the default maximum concurrent functions being run (-1 to specify no limits).   
The `types` allows you to specify different concurrencies for different types.   

Example:

```js
var throttler = PThrottler.create(15, {  // or new PThrottler()
    'network_io': 10,
    'disk_io': 50
});
```


### .enqueue(func, [type]): Promise

Enqueues a function to be ran. The function is expected to return a promise or a value.   
The returned promise is resolved when the function finishes execution.

The `type` argument is optional and can be a `string` or an array of `strings`.   
Use it to specify the type(s) associated with the function.   

The function will run as soon as a free slot is available for every `type`.  
If no `type` is passed or is unknown, the `defaultConcurrency` is used.  

The execution order is guaranteed for functions enqueued with the exact same `type` argument.

Example:

```js

var method = function () {
    return Q.resolve('foo');
};

var throttler = PThrottler.create(15, {
    'foo': 1,
    'bar': 2
});

// Single type, will only run when a free slot for
// "foo" is available
throttler.enqueue(function () {
    return method();    // method() returns some promise
}, 'foo')
.then(function (value) {
    console.log(value);
});

// Multiple type, will only run when a free slot for
// "foo" and "bar" are available
throttler.enqueue(function () {
    return method();    // method() returns some promise
}, ['foo', 'bar'])
.then(function (value) {
    console.log(value);
});
```


### .abort(): Promise

Aborts all current work being done.
Returns a promise that is resolved when the current running functions finish to execute.   
Any function that was in the queue waiting to be ran is removed immediately.

## Tests

`$ npm test`


## License

Released under the [MIT License](http://www.opensource.org/licenses/mit-license.php).
