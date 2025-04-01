import React from "react";
import { Classes, ProgressBar } from "@blueprintjs/core";
import "./index.less"; // 需要创建对应的样式文件

interface HorizontalStepsProps {
  steps: string[];
  currentStep: number;
}

const HorizontalSteps: React.FC<HorizontalStepsProps> = ({
  steps,
  currentStep,
}) => {
  const stepCount = steps.length;
  const showLine = stepCount > 1;
  const isOverflow = stepCount > 8;
  const stepWidth = isOverflow ? "100px" : `${100 / stepCount}%`;

  return (
    <div className={`horizontal-steps ${isOverflow ? "overflow" : ""}`}>
      <div className="steps-container">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isFirst = index === 0;
          const isLast = index === stepCount - 1;
          const position = isFirst ? "first" : isLast ? "last" : "middle";

          return (
            <div
              key={index}
              className={`step ${position} ${isActive ? "active" : ""}`}
              style={{ width: stepWidth }}
            >
              <div className="step-circle">
                {isActive && <div className="step-inner-circle" />}
              </div>
              <div className="step-label">{step}</div>
            </div>
          );
        })}
        {showLine && (
          <ProgressBar
            className="steps-line"
            value={(currentStep + 1) / stepCount}
            stripes={false}
          />
        )}
      </div>
    </div>
  );
};

export default HorizontalSteps;
