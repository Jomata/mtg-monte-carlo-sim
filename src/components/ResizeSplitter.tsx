import React from 'react'

const SampleSplitter = ({
  id = 'drag-bar',
  dir,
  isDragging,
  fixed = false,
  ...props
}: any) => {
  return (
    <div
      id={id}
      data-testid={id}
      className={[
        'sample-drag-bar',
        dir === 'horizontal' && 'sample-drag-bar--horizontal',
        fixed && 'sample-drag-bar--fixed',
        isDragging && 'sample-drag-bar--dragging'
      ].filter(Boolean).join(" ")}
      {...props}
    />
  )
}

export default SampleSplitter