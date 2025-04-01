import { diff } from "../diff-string";
import { FC, useState, useEffect } from "react";
const delay = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

export const DiffString: FC<{ diff: { old: string; now: string } }> = (props) => {
  const [diffResult, setDiffResult] = useState<ReturnType<typeof diff.diff>>();
  const [diffing, setDiffing] = useState(false);
  useEffect(() => {
    const process = async () => {
      setDiffing(true);
      await delay(100);
      const result = await diff.diff(props.diff.old, props.diff.now);

      setDiffResult(result);
      setDiffing(false);
    };
    process();

    // return JsDiff.diffString(props.diff.old, props.diff.now);
  }, [props.diff]);

  if (diffing || !diffResult) {
    return <div>Diffing...</div>;
  }
  console.log(diffResult.toString().richText, " string diff");

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: `${diffResult.toString().richText}`,
      }}
    >
    </div>
  );
};
