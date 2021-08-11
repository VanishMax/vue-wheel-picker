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
