'use strict';

var expect = require('expect.js');
var PThtroller = require('../');

describe('PThtroller', function () {
    var timeout;

    afterEach(function () {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    });

    describe('.enqueue', function () {
        it('return a promise', function () {
            var throttler = new PThtroller();
            var promise;

            promise = throttler.enqueue(function () { return 'foo'; });

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.a('function');

            promise = throttler.enqueue(function () { return Promise.resolve('foo'); });

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.a('function');
        });

        it('should call the function and fulfill the promise accordingly', function () {
            var throttler = new PThtroller();

            return throttler.enqueue(function () { return 'foo'; })
            .then(function (ret) {
                expect(ret).to.equal('foo');

                return throttler.enqueue(function () { return Promise.reject(new Error('foo')); });
            })
           .then(function () {
               throw new Error('Should have failed!');
           }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.equal('foo');
            });
        });

        it('should work with functions that return values syncronously', function () {
            var throttler = new PThtroller();

            throttler.enqueue(function () { return 'foo'; })
            .then(function (ret) {
                expect(ret).to.equal('foo');
            });
        });

        it('should work with functions that throw syncronously', function () {
            var throttler = new PThtroller();

            return throttler.enqueue(function () { throw new Error('bar'); })
            .then(function () {
                throw new Error('Should not be called!');
            }, function (err) {
                expect(err).to.be.an(Error);
                expect(err.message).to.be('bar');
            });
        });

        it('should assume the default concurrency when a type is not specified', function (next) {
            var throttler = new PThtroller(1);
            var calls = 0;

            throttler.enqueue(function () { calls++; return new Promise(function () {}); });
            throttler.enqueue(function () { next(new Error('Should not be called!')); });

            timeout = setTimeout(function () {
                expect(calls).to.equal(1);
                next();
            }, 25);
        });

        it('should assume the default concurrency when a type is not known', function (next) {
            var throttler = new PThtroller(1);
            var calls = 0;

            throttler.enqueue(function () { calls++; return new Promise(function () {}); }, 'foo_type');
            throttler.enqueue(function () { next(new Error('Should not be called!')); }, 'foo_type');

            timeout = setTimeout(function () {
                expect(calls).to.equal(1);
                next();
            }, 25);
        });

        it('should have different slots when type is not passed or is not known', function (next) {
            var throttler = new PThtroller(1);
            var calls = 0;

            throttler.enqueue(function () { calls++; return new Promise(function () {}); });
            throttler.enqueue(function () { calls++; return new Promise(function () {}); }, 'foo_type');
            throttler.enqueue(function () { next(new Error('Should not be called!')); });
            throttler.enqueue(function () { next(new Error('Should not be called!')); }, 'foo_type');

            timeout = setTimeout(function () {
                expect(calls).to.equal(2);
                next();
            }, 25);
        });

        it('should use the configured concurrency for the type', function (next) {
            var throttler = new PThtroller(1, {
                foo: 2,
                bar: 3
            });
            var calls = {
                def: 0,
                foo: 0,
                bar: 0
            };

            throttler.enqueue(function () { calls.def++; return new Promise(function () {}); });
            throttler.enqueue(function () { next(new Error('Should not be called!')); });
            throttler.enqueue(function () { calls.foo++; return new Promise(function () {}); }, 'foo');
            throttler.enqueue(function () { calls.foo++; return new Promise(function () {}); }, 'foo');
            throttler.enqueue(function () { calls.bar++; return new Promise(function () {}); }, 'bar');
            throttler.enqueue(function () { calls.bar++; return new Promise(function () {}); }, 'bar');
            throttler.enqueue(function () { calls.bar++; return new Promise(function () {}); }, 'bar');
            throttler.enqueue(function () { next(new Error('Should not be called!')); }, 'bar');

            timeout = setTimeout(function () {
                expect(calls.def).to.equal(1);
                expect(calls.foo).to.equal(2);
                expect(calls.bar).to.equal(3);
                next();
            }, 25);
        });
    });

    describe('.abort', function () {
        it('should clear the whole queue', function (next) {
            var throttler = new PThtroller(1, {
                foo: 2
            });
            var calls = 0;

            throttler.enqueue(function () { calls++; return Promise.resolve(); });
            throttler.enqueue(function () { next(new Error('Should not be called!')); });
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');
            throttler.enqueue(function () { next(new Error('Should not be called!')); }, 'foo');

            throttler.abort();

            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');

            timeout = setTimeout(function () {
                expect(calls).to.equal(4);
                next();
            }, 25);
        });

        it('should wait for currently running functions to finish', function (next) {
            var throttler = new PThtroller(1, {
                foo: 2
            });
            var calls = [];

            throttler.enqueue(function () { calls.push(1); return Promise.resolve(); });
            throttler.enqueue(function () { calls.push(2); return Promise.resolve(); });
            throttler.enqueue(function () {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        calls.push(3);
                        reject(new Error('foo'));
                    }, 100);
                });
            });
            throttler.enqueue(function () {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        calls.push(4);
                        resolve();
                    }, 150);
                });
            }, 'foo');

            timeout = setTimeout(function () {
                throttler.abort().then(function () {
                    expect(calls).to.eql([1, 2, 3, 4]);
                })
                .then(next, next);
            }, 25);
        });
    });


    describe('scheduler', function () {
        it('should start remaining tasks when one ends', function (next) {
            var throttler = new PThtroller(1, {
                foo: 2
            });
            var calls = 0;

            throttler.enqueue(function () { calls++; return Promise.resolve(); });
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');
            throttler.enqueue(function () { calls++; return Promise.resolve(); });
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');

            timeout = setTimeout(function () {
                expect(calls).to.equal(5);
                next();
            }, 25);
        });

        it('should respect the enqueue order', function (next) {
            var throttler = new PThtroller(1);
            var defCalls = [];
            var fooCalls = [];

            throttler.enqueue(function () {
                defCalls.push(1);
                return Promise.resolve();
            });

            throttler.enqueue(function () {
                defCalls.push(2);
                return Promise.resolve();
            });

            throttler.enqueue(function () {
                defCalls.push(3);
                return Promise.resolve();
            });

            throttler.enqueue(function () {
                fooCalls.push(1);
                return Promise.resolve();
            }, 'foo');

            throttler.enqueue(function () {
                fooCalls.push(2);
                return Promise.resolve();
            }, 'foo');

            throttler.enqueue(function () {
                fooCalls.push(3);
                return Promise.resolve();
            }, 'foo');

            timeout = setTimeout(function () {
                expect(defCalls).to.eql([1, 2, 3]);
                expect(fooCalls).to.eql([1, 2, 3]);
                next();
            }, 25);
        });

        it('should wait for one slot in every type on a multi-type function', function (next) {
            var throttler = new PThtroller(1, {
                foo: 1,
                bar: 2
            });
            var calls = 0;

            throttler.enqueue(function () { return new Promise(function () {}); }, 'foo');
            throttler.enqueue(function () { return new Promise(function () {}); }, 'bar');

            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'bar');
            throttler.enqueue(function () { next(new Error('Should not be called!')); }, ['foo', 'bar']);
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'bar');
            throttler.enqueue(function () { next(new Error('Should not be called!')); }, 'foo');

            timeout = setTimeout(function () {
                expect(calls).to.equal(2);
                next();
            }, 25);
        });

        it('should free all type slots when finished running a function', function (next) {
            var throttler = new PThtroller(1, {
                foo: 1,
                bar: 2
            });
            var calls = 0;

            throttler.enqueue(function () { return new Promise(function () {}); }, 'bar');
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, ['foo', 'bar']);
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'foo');
            throttler.enqueue(function () { calls++; return Promise.resolve(); }, 'bar');

            timeout = setTimeout(function () {
                expect(calls).to.equal(3);
                next();
            }, 25);
        });
    });
});
