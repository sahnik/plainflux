import React from 'react';
import { Hash } from 'lucide-react';

interface TagsListProps {
  tags: string[];
  onTagSelect: (tag: string) => void;
}

export const TagsList: React.FC<TagsListProps> = ({ tags, onTagSelect }) => {
  return (
    <div className="tags-list">
      {tags.map((tag) => (
        <div
          key={tag}
          className="tag-item"
          onClick={() => onTagSelect(tag)}
        >
          <Hash size={14} />
          <span>{tag}</span>
        </div>
      ))}
    </div>
  );
};