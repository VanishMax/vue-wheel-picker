export const MAX_RENDERED_AMOUNT = 60;

export type PickerValue = {
  value: number|string,
  text: string,

  // Hidden. Used in the Picker
  visibility?: boolean,
  sourceId?: number,
}

export type TouchDataType = {
  startY: number,
  yArr: (number[])[],
  touchScroll: number,
  delta: number,
};

export type EventNames = 'touchstart'|'touchmove'|'touchend';

export interface MouseEvents extends MouseEvent {
  type: 'mousedown'|'mousemove'|'mouseup',
}

export interface TouchEvents extends TouchEvent {
  type: EventNames,
}

export type MouseOrTouch = MouseEvents | TouchEvents;

export const isTouchEvent = (evt: MouseOrTouch): evt is TouchEvents => ['touchstart', 'touchmove', 'touchend'].includes(evt.type);

/** EaseOutQuart easing function */
export const easing = (pos: number) => {
  return -(Math.pow((pos - 1), 4) - 1);
};

export const getVisibleOptions = (source: PickerValue[], index: number) => {
  const min = index - (MAX_RENDERED_AMOUNT / 2) < 0 ? 0 : index - (MAX_RENDERED_AMOUNT / 2);
  const max = min + MAX_RENDERED_AMOUNT > (source.length) ? source.length : min + MAX_RENDERED_AMOUNT;
  return {
    options: source.slice(min, max),
    start: Math.floor(min),
  };
};

export const calculateVelocity = (yArr: (number[])[], itemHeight: number) => {
  let velocity: number;

  if (yArr.length === 1) {
    velocity = 0;
  } else {
    const startTime = yArr[yArr.length - 2][1];
    const endTime = yArr[yArr.length - 1][1];
    const startY = yArr[yArr.length - 2][0];
    const endY = yArr[yArr.length - 1][0];

    // Calculated speed
    velocity = ((startY - endY) / itemHeight) * 1000 / (endTime - startTime);
    const sign = velocity > 0 ? 1 : -1;

    velocity = Math.abs(velocity) > 30 ? 30 * sign : velocity;
  }

  return velocity;
};

export const wheelDebounce = (start: Function, end: Function, timer: number) => {
  let timeout: ReturnType<typeof setTimeout>;

  return (e: WheelEvent) => {
    clearTimeout(timeout);
    start(e);
    timeout = setTimeout(() => end(), timer);
  };
}
