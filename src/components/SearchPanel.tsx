import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { SearchResult } from '../types';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  results: SearchResult[];
  onResultSelect: (notePath: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch, results, onResultSelect }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const lastSearchedQuery = useRef<string>('');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query changes
  useEffect(() => {
    // Only search if the query is different from the last searched query
    if (debouncedQuery !== lastSearchedQuery.current) {
      lastSearchedQuery.current = debouncedQuery;
      if (debouncedQuery) {
        onSearch(debouncedQuery);
      } else if (debouncedQuery === '') {
        // Clear results when query is empty
        onSearch('');
      }
    }
  }, [debouncedQuery, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Still allow immediate search on Enter
    onSearch(query);
  };

  const toggleExpanded = (notePath: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(notePath)) {
      newExpanded.delete(notePath);
    } else {
      newExpanded.add(notePath);
    }
    setExpandedResults(newExpanded);
  };

  const totalMatches = results.reduce((sum, result) => sum + result.match_count, 0);

  return (
    <div className="search-panel">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-container">
          <Search size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="search-input"
          />
        </div>
      </form>

      {results.length > 0 && (
        <div className="search-stats">
          {results.length} {results.length === 1 ? 'note' : 'notes'} · {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
        </div>
      )}

      <div className="search-results">
        {results.map((result) => {
          const isExpanded = expandedResults.has(result.note.path);
          const snippetsToShow = isExpanded ? result.snippets : result.snippets.slice(0, 3);
          const hasMore = result.snippets.length > 3;

          return (
            <div key={result.note.path} className="search-result">
              <div
                className="result-header"
                onClick={() => onResultSelect(result.note.path)}
              >
                <div className="note-title">{result.note.title}</div>
                <div className="match-badge">
                  {result.match_count} {result.match_count === 1 ? 'match' : 'matches'}
                </div>
              </div>

              <div className="snippets-container">
                {snippetsToShow.map((snippet, index) => {
                  const beforeMatch = snippet.text.substring(0, snippet.match_start);
                  const matchText = snippet.text.substring(
                    snippet.match_start,
                    snippet.match_start + snippet.match_length
                  );
                  const afterMatch = snippet.text.substring(snippet.match_start + snippet.match_length);

                  return (
                    <div
                      key={`${result.note.path}-${index}`}
                      className="snippet"
                      onClick={() => onResultSelect(result.note.path)}
                    >
                      <span className="line-number">Line {snippet.line_number}</span>
                      <span className="snippet-text">
                        {beforeMatch}
                        <mark className="highlight">{matchText}</mark>
                        {afterMatch}
                      </span>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <button
                  className="show-more-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(result.note.path);
                  }}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={14} />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Show all {result.snippets.length} matches
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}

        {query && results.length === 0 && (
          <div className="no-results">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
};
