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

export const initCircularBuffer = (source: PickerValue[], current: number) => {
  const len = source.length
  if (len < MAX_RENDERED_AMOUNT) {
    return {
      cycle: source.map((item, index) => ({ ...item, sourceId: index })),
      startIndex: 0,
    };
  }

  const halfRendered = MAX_RENDERED_AMOUNT / 2;
  const minIndex = current >= halfRendered ? current - halfRendered : 0;
  const maxIndex = current > len - halfRendered ? len : current + halfRendered;
  return {
    cycle: source.slice(minIndex, maxIndex).map((item, index) => ({ ...item, sourceId: minIndex + index })),
    startIndex: 0,
  };
};

export const changeCircularBuffer = (source: PickerValue[], cycle: PickerValue[], index: number, current: number) => {
  for (let i = index; i < index + cycle.length / 2; i++) {
    const sourceId = cycle[i % cycle.length].sourceId as number;
    const prevIndex = index - i < 0 ? cycle.length - (index - i) : index - i;
    const lastSourceId = cycle[prevIndex].sourceId as number;

    let changed = false;
    if (current >= MAX_RENDERED_AMOUNT + sourceId) {
      cycle[i % cycle.length] = source[sourceId + Math.round(current - MAX_RENDERED_AMOUNT - sourceId)] as PickerValue;
      changed = true;
    }
    if (current >= lastSourceId) {
      cycle[prevIndex] = source[lastSourceId + Math.round(current - lastSourceId)] as PickerValue;
      changed = true;
    }

    if (!changed) break;
  }
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
