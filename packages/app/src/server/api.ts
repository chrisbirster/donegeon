import type { Task } from "@donegeon/db";
import { action } from "@solidjs/router";

export const getFetch = async (url: string) => {
  const response = await fetch(url, {
    method: "GET",
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error in response: ${err}`);
  } else {
    const result = await response.json();
    return result;
  }
}

export const postFetch = async (url: string, data: string) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: data,
    credentials: "include",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Unknown error occurred');
  }
  const results = await response.json();
  return results;
}

export const deleteFetch = async (url: string) => {
  const response = await fetch(url, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error in response: ${err}`);
  } else {
    const result = await response.json();
    return result;
  }
}


export const listTasks = async () => {
  try {
    const response = await getFetch('https://api.donegeon.com/api/tasks')
    return response;
  } catch (err) {
    throw new Error(`Error fetching foo: ${err}`);
  }
}

export const getTask = async (taskId: string) => {
  try {
    const response = await getFetch(`https://api.donegeon.com/api/tasks/${taskId}`)
    return response;
  } catch (err) {
    throw new Error(`Error fetching foo: ${err}`);
  }
}

export const updateTask = async (taskId: number) => {
  console.log(taskId);
  return "update "
}

export const createTask = action(async (task: Task) => {
  try {
    const title = task.title
    const description = task.description
    const data = JSON.stringify({ title, description })
    const response = await postFetch("https://api.donegeon.com/api/tasks", data)
    console.log(response)
    return data
  } catch (error) {
    throw new Error(`Error creating account: ${error}`);
  }
});

export const deleteTask = async (taskId: number) => {
  try {
    const response = await getFetch(`https://api.donegeon.com/api/tasks/${taskId}`)
    return response;
  } catch (err) {
    throw new Error(`Error fetching foo: ${err}`);
  }
}

