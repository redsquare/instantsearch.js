/* eslint-env jest, jasmine */

import connect from './connectInfiniteHits.js';
jest.mock('../core/createConnector');

const context = {context: {multiIndexContext: {targettedIndex: 'index'}}};
const getProvidedProps = connect.getProvidedProps.bind(context);

describe('connectInfiniteHits', () => {
  it('provides the current hits to the component', () => {
    const hits = [{}];
    const props = getProvidedProps(null, null, {
      results: {index: {hits, page: 0, hitsPerPage: 2, nbPages: 3}},
    });
    expect(props).toEqual({hits, hasMore: true});
  });

  it('accumulate hits internally', () => {
    const hits = [{}, {}];
    const hits2 = [{}, {}];
    const res1 = getProvidedProps(null, null, {
      results: {index: {hits, page: 0, hitsPerPage: 2, nbPages: 3}},
    });
    expect(res1.hits).toEqual(hits);
    expect(res1.hasMore).toBe(true);
    const res2 = getProvidedProps(null, null, {
      results: {index: {hits: hits2, page: 1, hitsPerPage: 2, nbPages: 3}},
    });
    expect(res2.hits).toEqual([...hits, ...hits2]);
    expect(res2.hasMore).toBe(true);
  });

  it('should not reset while accumulating results', () => {
    const nbPages = 100;
    let allHits = [];

    for (let page = 0; page < nbPages - 1; page++) {
      const hits = [{}, {}];
      allHits = [...allHits, ...hits];
      const res = getProvidedProps(null, null, {
        results: {index: {
          hits,
          page,
          hitsPerPage: hits.length,
          nbPages,
        },
        },
      });
      expect(res.hits).toEqual(allHits);
      expect(res.hits.length).toEqual((page + 1) * 2);
      expect(res.hasMore).toBe(true);
    }

    const hits = [{}, {}];
    allHits = [...allHits, ...hits];
    const res = getProvidedProps(null, null, {
      results: {index: {
        hits,
        page: nbPages - 1,
        hitsPerPage: hits.length,
        nbPages,
      },
      },
    });
    expect(res.hits.length).toEqual(nbPages * 2);
    expect(res.hits).toEqual(allHits);
    expect(res.hasMore).toBe(false);
  });

  it('Indicates the last page after several pages', () => {
    const hits = [{}, {}];
    const hits2 = [{}, {}];
    const hits3 = [{}];
    getProvidedProps(null, null, {
      results: {index: {hits, page: 0, hitsPerPage: 2, nbPages: 3}},
    });
    getProvidedProps(null, null, {
      results: {index: {hits: hits2, page: 1, hitsPerPage: 2, nbPages: 3}},
    });
    const props = getProvidedProps(null, null, {
      results: {index: {hits: hits3, page: 2, hitsPerPage: 2, nbPages: 3}},
    });
    expect(props.hits).toEqual([...hits, ...hits2, ...hits3]);
    expect(props.hasMore).toBe(false);
  });

  it('adds 1 to page when calling refine', () => {
    const props = {};

    const state0 = {};

    const state1 = connect.refine(props, state0);
    expect(state1).toEqual({page: 1});

    const state2 = connect.refine(props, state1);
    expect(state2).toEqual({page: 2});
  });

  it('automatically converts String state to Number', () => {
    const props = {};

    const state0 = {page: '0'};

    const state1 = connect.refine(props, state0);
    expect(state1).toEqual({page: 1});
  });
});
