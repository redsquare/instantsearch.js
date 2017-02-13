import React from 'react';
import {storiesOf} from '@kadira/storybook';
import {Configure, MultiIndexContext, Highlight} from '../packages/react-instantsearch/dom';
import {connectHits, connectMultiHits} from '../packages/react-instantsearch/connectors';
import {WrapWithHits} from './util';
import Autosuggest from 'react-autosuggest';

const stories = storiesOf('Configure', module);

stories.add('default', () =>
    <ConfigureExample/>
);

class ConfigureExample extends React.Component {
  constructor() {
    super();
    this.state = {hitsPerPage: 3};
  }
  onClick() {
    const hitsPerPage = this.state.hitsPerPage === 3 ? 1 : 3;
    this.setState({hitsPerPage});
  }
  render() {
    return <WrapWithHits>
      <AutoComplete/>
      <Configure hitsPerPage={this.state.hitsPerPage} highlightPreTag="em"/>
      <button onClick={this.onClick.bind(this)}>Toggle HitsPerPage</button>
      <MultiIndexContext indexName="bestbuy">
        <div> <Configure hitsPerPage={2} highlightPreTag="vv"/>
          <CustomHits /> </div>
      </MultiIndexContext>
      <MultiIndexContext indexName="airbnb">
        <div><Configure hitsPerPage={4} />
          <CustomHits /></div>
      </MultiIndexContext>
    </WrapWithHits>;
  }
}

const AutoComplete = connectMultiHits(({hits, query, refine}) => <Autosuggest
  suggestions={hits}
  multiSection={true}
  onSuggestionsFetchRequested={({value}) => refine(value)}
  onSuggestionsClearRequested={() => refine('')}
  getSuggestionValue={hit => hit.name}
  renderSuggestion={hit =>
    <div>
      <div>{hit.name}</div>
    </div>
  }
  inputProps={{
    placeholder: 'Type a product',
    value: query,
    onChange: () => {
    },
  }}
  renderSectionTitle={section => section.index}
  getSectionSuggestions={section => section.hits}
/>);

const CustomHits = connectHits(({hits}) =>
  <div className="hits">
    {hits.map((hit, idx) =>
      <div key={idx} className="hit">
        <div>
          <div className="hit-picture"><img src={`${hit.image}`} /></div>
        </div>
        <div className="hit-content">
          <div>
            <Highlight attributeName="name" hit={hit} />
            <span> - ${hit.price}</span>
            <span> - {hit.rating} stars</span>
          </div>
          <div className="hit-type">
            <Highlight attributeName="type" hit={hit} />
          </div>
          <div className="hit-description">
            <Highlight attributeName="description" hit={hit} />
          </div>
        </div>
      </div>
    )}
  </div>
);
