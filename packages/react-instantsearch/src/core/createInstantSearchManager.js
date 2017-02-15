import algoliasearchHelper, {SearchParameters} from 'algoliasearch-helper';

import createWidgetsManager from './createWidgetsManager';
import createStore from './createStore';
import highlightTags from './highlightTags.js';
import {omit} from 'lodash';

/**
 * Creates a new instance of the InstantSearchManager which controls the widgets and
 * trigger the search when the widgets are updated.
 * @param {string} indexName - the main index name
 * @param {object} initialState - initial widget state
 * @param {object} SearchParameters - optional additional parameters to send to the algolia API
 * @return {InstantSearchManager} a new instance of InstantSearchManager
 */
export default function createInstantSearchManager({
  indexName,
  initialState = {},
  algoliaClient,
  searchParameters = {},
}) {
  const baseSP = new SearchParameters({
    ...searchParameters,
    index: indexName,
    ...highlightTags,
  });

  const helper = algoliasearchHelper(algoliaClient, indexName, baseSP);
  helper.on('result', handleSearchSuccess);
  helper.on('error', handleSearchError);

  const derivedHelpers = {};
  let indexMapping = {};

  let initialSearchParameters = helper.state;

  const widgetsManager = createWidgetsManager(onWidgetsUpdate);

  const store = createStore({
    widgets: initialState,
    metadata: [],
    results: null,
    error: null,
    searching: false,
  });

  function updateClient(client) {
    helper.setClient(client);
    search();
  }

  function getMetadata(state) {
    return widgetsManager.getWidgets()
      .filter(widget => Boolean(widget.getMetadata))
      .map(widget => widget.getMetadata(state));
  }

  function getSearchParameters() {
    indexMapping = {};
    const mainParameters = widgetsManager.getWidgets()
      .filter(widget => Boolean(widget.getSearchParameters))
      .filter(widget => !widget.multiIndexContext || widget.multiIndexContext.targettedIndex === indexName)
      .reduce(
        (res, widget) => widget.getSearchParameters(res),
        initialSearchParameters
      );

    indexMapping[mainParameters.index] = indexName;

    const derivatedWidgets = widgetsManager.getWidgets()
      .filter(widget => Boolean(widget.getSearchParameters))
      .filter(widget => widget.multiIndexContext && widget.multiIndexContext.targettedIndex !== indexName);

    const derivatedWidgetsByIndex = derivatedWidgets.reduce((indices, widget) => {
      const targettedIndex = widget.multiIndexContext.targettedIndex;
      const index = indices.find(i => i.targettedIndex === targettedIndex);
      if (index) {
        index.widgets.push(widget);
      } else {
        indices.push({targettedIndex, widgets: [widget]});
      }
      return indices;
    }, []);

    const derivatedParameters = derivatedWidgetsByIndex.map(widgets => {
      const parameters = widgets.widgets.reduce(
        (res, widget) =>
          new SearchParameters({
            ...res,
            ...widget.getSearchParameters(res),
          }),
        new SearchParameters(
          {...mainParameters, index: widgets.targettedIndex}
        )
      );
      indexMapping[parameters.index] = widgets.targettedIndex;

      return parameters;
    });

    return {mainParameters, derivatedParameters};
  }

  function search() {
    const {mainParameters, derivatedParameters} = getSearchParameters(helper.state);

    helper.setState(mainParameters);
    derivatedParameters.forEach(derivatedSearchParameters => {
      const index = derivatedSearchParameters.index;
      let derivedHelper = derivedHelpers[index];

      if (derivedHelpers[index]) {
        derivedHelpers[index].detach();
      }

      derivedHelper = helper.derive(sp => new SearchParameters({
        ...sp,
        ...derivatedSearchParameters,
      }));
      derivedHelper.on('result', handleSearchSuccess);
      derivedHelper.on('error', handleSearchError);
      derivedHelpers[index] = derivedHelper;
    });

    helper.search();
  }

  function handleSearchSuccess(content) {
    const state = store.getState();
    const results = state.results ? state.results : [];
    results[indexMapping[content.index]] = content;
    const nextState = omit({
      ...store.getState(),
      results,
      searching: false,
    }, 'resultsFacetValues');
    store.setState(nextState);
  }

  function handleSearchError(error) {
    const nextState = omit({
      ...store.getState(),
      error,
      searching: false,
    }, 'resultsFacetValues');
    store.setState(nextState);
  }

  // Called whenever a widget has been rendered with new props.
  function onWidgetsUpdate() {
    const metadata = getMetadata(store.getState().widgets);

    store.setState({
      ...store.getState(),
      metadata,
      searching: true,
    });

    // Since the `getSearchParameters` method of widgets also depends on props,
    // the result search parameters might have changed.
    search();
  }

  function transitionState(nextSearchState) {
    const searchState = store.getState().widgets;
    return widgetsManager.getWidgets()
      .filter(widget => Boolean(widget.transitionState))
      .reduce((res, widget) =>
          widget.transitionState(searchState, res)
        , nextSearchState);
  }

  function onExternalStateUpdate(nextSearchState) {
    const metadata = getMetadata(nextSearchState);

    store.setState({
      ...store.getState(),
      widgets: nextSearchState,
      metadata,
      searching: true,
    });

    search();
  }

  function onSearchForFacetValues(nextSearchState) {
    store.setState({
      ...store.getState(),
      searchingForFacetValues: true,
    });

    helper.searchForFacetValues(nextSearchState.facetName, nextSearchState.query)
      .then(content => {
        store.setState({
          ...store.getState(),
          resultsFacetValues: {
            ...store.getState().resultsFacetValues,
            [nextSearchState.facetName]: content.facetHits,
            query: nextSearchState.query,
          },
          searchingForFacetValues: false,
        });
      }, error => {
        store.setState({
          ...store.getState(),
          error,
          searchingForFacetValues: false,
        });
      })
      .catch(error => {
        // Since setState is synchronous, any error that occurs in the render of a
        // component will be swallowed by this promise.
        // This is a trick to make the error show up correctly in the console.
        // See http://stackoverflow.com/a/30741722/969302
        setTimeout(() => {
          throw error;
        });
      });
  }

  function updateIndex(newIndex) {
    initialSearchParameters = initialSearchParameters.setIndex(newIndex);
    search();
  }

  function getWidgetsIds() {
    return store.getState().metadata.reduce((res, meta) =>
        typeof meta.id !== 'undefined' ? res.concat(meta.id) : res
      , []);
  }

  return {
    store,
    widgetsManager,
    getWidgetsIds,
    onExternalStateUpdate,
    transitionState,
    onSearchForFacetValues,
    updateClient,
    updateIndex,
  };
}
